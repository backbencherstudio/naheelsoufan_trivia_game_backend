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
import appConfig from 'src/config/app.config';
import { SojebStorage } from 'src/common/lib/Disk/SojebStorage';

@Injectable()
export class MultiplayerGameService {
  constructor(
    private prisma: PrismaService,
    private readonly gameGateway: MessageGateway,
  ) { }

  /**
   * API 1: Create a new multiplayer game, a room, and add the host as the first player.
   */
  async createGame(createDto: CreateMultiplayerGameDto, hostId: string) {
    try {
      // Check total games created across all types
      const totalGamesCount = await this.prisma.game.count({
        where: {
          host_id: hostId,
          mode: {
            in: ['ONLINE_QUICK_GAME'],
          },
        },
      });

      let requiresSubscription = false;
      let activeSubscription = null;

      // If user has already created any game (free one used), check for subscription
      if (totalGamesCount >= 0) {
        requiresSubscription = true;

        const activeSubscriptions = await this.prisma.subscription.findMany({
          where: {
            user_id: hostId,
            status: 'active',
          },
          include: {
            subscription_type: true,
          },
        });

        if (activeSubscriptions.length > 0) {
          // Default to the first one
          activeSubscription = activeSubscriptions[0];

          // If looking for ONLINE_QUICK_GAME, try to find a specific match
          if (createDto.mode === 'ONLINE_QUICK_GAME') {
            const specificSub = activeSubscriptions.find(
              (s) => s.subscription_type.type === 'ONLINE_QUICK_GAME',
            );
            if (specificSub) {
              activeSubscription = specificSub;
            }
          }
        }


        if (!activeSubscription) {
          return {
            success: false,
            message: `No games remaining in your subscription. Please upgrade or purchase a new subscription.`,
            data: {
              requires_subscription: true,
              total_games_created: totalGamesCount,
            },
          };
        }

        // Check if the subscription type matches the game mode for ONLINE_QUICK_GAME
        if (
          createDto.mode === 'ONLINE_QUICK_GAME' &&
          activeSubscription.subscription_type.type !== 'ONLINE_QUICK_GAME'
        ) {
          return {
            success: false,
            message: `You need an 'Online Quick Game' subscription to create this game. Your current subscription is for ${activeSubscription.subscription_type.type.replace(
              '_',
              ' ',
            )}.`,
            data: {
              requires_specific_subscription: true,
              required_type: 'ONLINE_QUICK_GAME',
              current_type: activeSubscription.subscription_type.type,
            },
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
              total_games_created: totalGamesCount,
            },
          };
        }
      }

      // Check games of this specific type (for informational purposes only)
      const gamesOfThisType = await this.prisma.game.count({
        where: {
          host_id: hostId,
          mode: createDto.mode,
        },
      });

      return this.prisma.$transaction(async (tx) => {
        // If user has used their free game and has a subscription, increment the games played count
        if (requiresSubscription && activeSubscription) {
          await tx.subscription.update({
            where: { id: activeSubscription.id },
            data: { games_played_count: { increment: 1 } },
          });
        }

        const game = await tx.game.create({
          data: {
            mode: createDto.mode,
            language_id: createDto.language_id,
            host_id: hostId,
            game_phase: 'waiting',
            // Add subscription_id if using subscription
            subscription_id: requiresSubscription
              ? activeSubscription?.id
              : null,
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

        const isFirstGameOverall = totalGamesCount === 0;

        return {
          success: true,
          message: isFirstGameOverall
            ? `Congratulations! Your first free game created successfully. You can create one free game of any type.`
            : `${createDto.mode.replace('_', ' ')} game created successfully using your subscription.`,
          data: {
            game,
            room,
            hostPlayer,
            is_first_game_overall: isFirstGameOverall,
            games_of_this_type: gamesOfThisType + 1,
            total_games_created: totalGamesCount + 1,
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
        return {
          success: false,
          message: 'Room not found.',
          statusCode: 404,
        };
      }

      if (room.host_id !== userId) {
        return {
          success: false,
          message: 'Only the host can update the room details.',
          statusCode: 403,
        };
      }

      if (room.status !== 'WAITING') {
        return {
          success: false,
          message: 'Cannot update details for a game that is in progress or completed.',
          statusCode: 400,
        };
      }

      const updatedRoom = await this.prisma.room.update({
        where: { id: roomId, host_id: room.host_id },
        data: {
          name: updateDto.name,
          question_time: updateDto.question_time,
        },
      });

      return {
        success: true,
        message: 'Room details updated successfully.',
        data: updatedRoom,
      };
    } catch (error) {
      return {
        success: false,
        message: 'An unexpected error occurred while updating the room details.',
        statusCode: 500,
      };
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

    if (
      room.game?.subscription &&
      room.game.subscription.subscription_type.players
    ) {
      maxPlayers = room.game.subscription.subscription_type.players;
    } else if (isMaxLimit) {
      maxPlayers = isMaxLimit;
    } else {
      maxPlayers = 4;
    }

    if (room._count.game_players >= maxPlayers) {
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

      const playerIds = room.game_players.map((player) => player.user.id);
      playerIds.push(newPlayer.user.id);



      const avatarUrl = newPlayer.user.avatar
        ? SojebStorage.url(
          appConfig().storageUrl.avatar + newPlayer.user.avatar,
        )
        : null;

      const playerJoinedData = {
        player_id: newPlayer.id,
        player_order: newPlayer.player_order,
        user_id: newPlayer.user_id,
        name: newPlayer.user.name,
        avatar: newPlayer.user.avatar,
        avatar_url: avatarUrl,
      };

      this.gameGateway.server.to(playerIds).emit('playerJoined', playerJoinedData);


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

  async findUnplayedGame(userId: string) {
    try {
      const unplayedOnlineGamePlayers = await this.prisma.gamePlayer.findMany({
        where: {
          user_id: userId,
          game: {
            game_phase: 'waiting',
            rooms: {
              some: {},
            },
          },
        },
        include: {
          game: {
            include: {
              game_players: {
                select: {
                  id: true,
                  player_name: true,
                  player_order: true,
                  score: true,
                  user: {
                    select: {
                      id: true,
                      name: true,
                      avatar: true,
                    },
                  },
                },
                orderBy: {
                  player_order: 'asc',
                },
              },
              language: {
                select: {
                  id: true,
                  name: true,
                },
              },
              rooms: {
                select: {
                  id: true,
                  code: true,
                },
              },
            },
          },
        },
        orderBy: {
          created_at: 'desc',
        },
      });

      if (
        !unplayedOnlineGamePlayers ||
        unplayedOnlineGamePlayers.length === 0
      ) {
        return {
          success: true,
          message: 'No waiting online games found for this player.',
          data: [],
        };
      }

      const formattedGames = unplayedOnlineGamePlayers.map((gp) => {
        const { game, ...playerInfo } = gp;
        return {
          game_info: {
            id: game.id,
            mode: game.mode,
            status: game.status,
            game_phase: game.game_phase,
            current_question: game.current_question,
            total_questions: game.total_questions,
            current_player_id: game.current_player_id,
            language: game.language,
            room_code: game.rooms.length > 0 ? game.rooms[0].code : null,
          },
          your_player_info: {
            id: playerInfo.id,
            player_name: playerInfo.player_name,
            player_order: playerInfo.player_order,
            score: playerInfo.score,
          },
          all_players: game.game_players.map((p) => ({
            id: p.id,
            player_name: p.player_name,
            player_order: p.player_order,
            score: p.score,
            user: p.user,
          })),
        };
      });

      return {
        success: true,
        message: `Found ${formattedGames.length} waiting online game(s).`,
        data: formattedGames,
      };
    } catch (error) {
      console.error(
        `Error finding unplayed online games for user ${userId}: ${error.message}`,
        error.stack,
      );
      return {
        success: false,
        message:
          'An unexpected error occurred while searching for online games.',
        statusCode: 500,
      };
    }
  }
}
