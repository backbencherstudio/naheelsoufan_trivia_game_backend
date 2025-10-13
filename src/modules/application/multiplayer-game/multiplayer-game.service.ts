import {
  Injectable,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
  ForbiddenException,
} from '@nestjs/common';

import { CreateMultiplayerGameDto } from './dto/create-multiplayer-game.dto';

import { PrismaService } from 'src/prisma/prisma.service';
import { randomBytes } from 'crypto';
import { UpdateRoomDto } from './dto/update-room.dto';
import { MessageGateway } from 'src/modules/chat/message/message.gateway';

@Injectable()
export class MultiplayerGameService {
  constructor(
    private prisma: PrismaService,
    private readonly gameGateway: MessageGateway,
  ) {}

  /**
   * API 1: Create a new multiplayer game, a room, and add the host as the first player.
   */
  async createGame(createDto: CreateMultiplayerGameDto, hostId: string) {
    try {
      const gamesOfThisType = await this.prisma.game.count({
        where: {
          host_id: hostId,
          mode: createDto.mode,
        },
      });

      if (gamesOfThisType > 0) {
        const activeSubscription = await this.prisma.subscription.findFirst({
          where: {
            user_id: hostId,
            status: 'active',
          },
          include: {
            subscription_type: true,
          },
        });

        if (!activeSubscription) {
          return {
            success: false,
            message: `No games remaining in your subscription. Please upgrade or purchase a new subscription.`,
            data: { requires_subscription: true },
          };
        }

        const gamesPlayed = activeSubscription.games_played_count;
        const gamesLimit = activeSubscription.subscription_type.games;

        if (gamesLimit !== -1 && gamesPlayed >= gamesLimit) {
          await this.prisma.subscription.update({
            where: { id: activeSubscription.id },
            data: { status: 'completed' },
          });

          return {
            success: false,
            message:
              'No games remaining in your subscription. Please upgrade or purchase a new subscription.',
            data: {
              subscription_exhausted: true,
              games_limit: gamesLimit,
              games_played: gamesPlayed,
            },
          };
        }
      }

      return this.prisma.$transaction(async (tx) => {
        if (gamesOfThisType > 0) {
          const subscriptionToUpdate = await tx.subscription.findFirst({
            where: { user_id: hostId, status: 'active' },
          });
          if (subscriptionToUpdate) {
            await tx.subscription.update({
              where: { id: subscriptionToUpdate.id },
              data: { games_played_count: { increment: 1 } },
            });
          }
        }

        const game = await tx.game.create({
          data: {
            mode: createDto.mode,
            language_id: createDto.language_id,
            host_id: hostId,
            game_phase: 'waiting',
          },
        });

        const hostUser = await tx.user.findUnique({
          where: { id: hostId },
          select: { name: true },
        });

        const roomCode = `RM${randomBytes(3).toString('hex').toUpperCase()}`;

        const room = await tx.room.create({
          data: {
            code: roomCode,
            game_id: game.id,
            host_id: hostId,
            status: 'WAITING',
          },
        });

        const hostPlayer = await tx.gamePlayer.create({
          data: {
            game_id: game.id,
            room_id: room.id,
            user_id: hostId,
            player_order: 1,
            status: 'ACTIVE',
            player_name: hostUser.name,
          },
          include: {
            user: { select: { id: true, name: true, avatar: true } },
          },
        });

        const isFirstGameOfType = gamesOfThisType === 0;

        return {
          success: true,
          message: isFirstGameOfType
            ? `Congratulations! Your first ${createDto.mode.replace('_', ' ')} game created successfully (FREE).`
            : `${createDto.mode.replace('_', ' ')} game created successfully using your subscription.`,
          data: {
            game,
            room,
            hostPlayer,
            is_first_game_of_type: isFirstGameOfType,
          },
        };
      });
    } catch (error) {
      console.error(
        `Error creating multiplayer game: ${error.message}`,
        error.stack,
      );
      return {
        success: false,
        message: 'An unexpected error occurred while creating the game.',
        statusCode: 500,
      };
    }
  }

  //update room details
  async updateRoomDetails(
    roomId: string,
    updateDto: UpdateRoomDto,
    userId: string,
  ) {
    try {
      const room = await this.prisma.room.findUnique({
        where: { id: roomId },
      });
      if (!room) {
        throw new NotFoundException('Room not found.');
      }

      if (room.host_id !== userId) {
        throw new ForbiddenException(
          'Only the host can update the room details.',
        );
      }

      if (room.status !== 'WAITING') {
        throw new BadRequestException(
          'Cannot update details for a game that is in progress or completed.',
        );
      }

      const updatedRoom = await this.prisma.room.update({
        where: { id: roomId, host_id: room.host_id },
        data: {
          name: updateDto.name,
          scheduled_at: updateDto.scheduled_at,
        },
      });

      return {
        success: true,
        message: 'Room details updated successfully.',
        data: updatedRoom,
      };
    } catch (error) {
      console.log(error);
    }
  }

  /**
   * API 2: Allow a user to join an existing multiplayer game using a room code.
   */
  async joinGame(identifier: string, userId: string, isMaxLimit?: number) {
    let room: any;
    let gameId: string;

    const roomInclude = {
      game_players: {
        include: { user: { select: { id: true, name: true, avatar: true } } },
      },
      _count: {
        select: { game_players: true },
      },
      game: {
        include: {
          subscription: {
            include: {
              subscription_type: true,
            },
          },
        },
      },
    };

    if (identifier.length === 8) {
      room = await this.prisma.room.findUnique({
        where: { code: identifier.toUpperCase() },
        include: roomInclude,
      });
      if (room) {
        gameId = room.game_id;
      }
    } else {
      gameId = identifier;
      room = await this.prisma.room.findFirst({
        where: { game_id: identifier },
        include: roomInclude,
      });
    }

    if (!room) {
      throw new NotFoundException(
        'Game or Room not found with the provided identifier.',
      );
    }

    const existingPlayer = await this.prisma.gamePlayer.findFirst({
      where: {
        game_id: gameId,
        user_id: userId,
      },
    });

    if (existingPlayer) {
      const answerCount = await this.prisma.playerAnswer.count({
        where: { game_player_id: existingPlayer.id },
      });

      if (answerCount > 0) {
        throw new ForbiddenException(
          'You cannot rejoin because you have already participated in the game.',
        );
      }
      return {
        success: true,
        message: 'Rejoined the game successfully.',
        data: {
          player: existingPlayer,
          allPlayers: room.game_players,
        },
      };
    }

    let maxPlayers: number;

    if (isMaxLimit) {
      maxPlayers = isMaxLimit;
    } else if (
      room.game?.subscription &&
      room.game.subscription.subscription_type.players > 0
    ) {
      maxPlayers = room.game.subscription.subscription_type.players;
    } else {
      maxPlayers = 4;
    }

    if (room._count.game_players >= isMaxLimit) {
      throw new BadRequestException('This room is already full.');
    }

    if (room.status !== 'WAITING') {
      throw new BadRequestException(
        'This game is already in progress. New players cannot join.',
      );
    }

    try {
      const joiningUser = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { name: true },
      });

      if (!joiningUser) {
        throw new NotFoundException('Joining user not found.');
      }
      const newPlayer = await this.prisma.gamePlayer.create({
        data: {
          game_id: gameId,
          room_id: room.id,
          user_id: userId,
          player_order: room._count.game_players + 1,
          status: 'ACTIVE',
          player_name: joiningUser.name,
        },
        include: {
          user: { select: { id: true, name: true, avatar: true } },
          room: true,
        },
      });

      this.gameGateway.emitPlayerJoined(room.id, newPlayer);

      return {
        success: true,
        message: 'Successfully joined the game.',
        data: newPlayer,
      };
    } catch (error) {
      throw new InternalServerErrorException(
        `Could not join the game: ${error.message}`,
      );
    }
  }
}
