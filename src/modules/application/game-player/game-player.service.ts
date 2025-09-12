import { Injectable, BadRequestException, NotFoundException, HttpException, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { JoinGameDto, LeaveGameDto } from './dto/join-game.dto';
import { AnswerQuestionDto, SkipQuestionDto } from './dto/answer-question.dto';
import { StartGameDto, EndGameDto, UpdateScoreDto, GetGameQuestionsDto } from './dto/gameplay.dto';
import { SojebStorage } from 'src/common/lib/Disk/SojebStorage';
import appConfig from 'src/config/app.config';

@Injectable()
export class GamePlayerService {
    constructor(private readonly prisma: PrismaService) { }

    // Join a game
    async joinGame(userId: string, joinGameDto: JoinGameDto) {
        try {
            const { game_id, user_ids, room_code } = joinGameDto

            // Check if game exists and is active
            // Check if game exists
            const game = await this.prisma.game.findUnique({
                where: { id: 'game_id' },
                include: {
                    _count: {
                        select: { game_players: true }
                    }
                }
            });

            if (!game) {
                throw new NotFoundException('Game not found');
            }

            const isHost = game.host_id === userId;

            // Check game status - allow host to join their own game even if not active
            if (!isHost && game.status !== 'active') {
                throw new BadRequestException('Game is not active');
            }

            // If host is joining and has user_ids, handle host adding players scenario
            if (isHost && user_ids && user_ids.length > 0) {
                return await this.hostJoinWithPlayers(userId, joinGameDto, game);
            }

            // Check if game is full for single user joining (assume max 8 players)
            const maxPlayers = 8;
            if (game._count.game_players >= maxPlayers) {
                throw new BadRequestException('Game is full');
            }

            // Check if user is already in the game
            const existingPlayer = await this.prisma.gamePlayer.findFirst({
                where: {
                    game_id: game_id,
                    user_id: userId
                }
            });

            if (existingPlayer) {
                throw new BadRequestException('User already in this game');
            }

            // Handle room joining if room_code is provided
            let roomId = null;
            if (room_code) {
                const room = await this.prisma.room.findUnique({
                    where: { code: room_code },
                    include: { game: true }
                });

                if (!room || room.game_id !== game_id) {
                    throw new BadRequestException('Invalid room code for this game');
                }
                roomId = room.id;
            }

            // Determine player order
            const playerOrder = game._count.game_players + 1;

            const gamePlayer = await this.prisma.gamePlayer.create({
                data: {
                    game_id: joinGameDto.game_id,
                    user_id: userId,
                    room_id: roomId,
                    player_order: playerOrder,
                },
                select: {
                    id: true,
                    game_id: true,
                    user_id: true,
                    room_id: true,
                    score: true,
                    correct_answers: true,
                    wrong_answers: true,
                    skipped_answers: true,
                    player_order: true,
                    final_rank: true,
                    created_at: true,
                    updated_at: true,
                    user: {
                        select: {
                            id: true,
                            name: true,
                            email: true,
                            avatar: true,
                        }
                    },
                    game: {
                        select: {
                            id: true,
                            mode: true,
                            status: true,
                        }
                    },
                    room: {
                        select: {
                            id: true,
                            code: true,
                        }
                    }
                },
            });

            await this.prisma.game.update({
                where: { id: game_id },
                data: {
                    ...(isHost && { status: 'active' }) // Set to active when host joins
                }
            });

            return {
                success: true,
                message: isHost ? 'Host successfully joined the game' : 'Successfully joined the game',
                data: {
                    ...gamePlayer,
                    is_host: isHost,
                },
            };
        } catch (error) {
            if (error instanceof HttpException) {
                throw error;
            }
            throw new InternalServerErrorException(`Error joining game: ${error.message}`);
        }
    }

    // Host joins their game and adds other players
    private async hostJoinWithPlayers(userId: string, joinGameDto: JoinGameDto, game: any) {
        // Remove duplicates from userIds array and ensure host is included
        const uniqueUserIds = [...new Set([userId, ...joinGameDto.user_ids])];

        // Check if adding all users would exceed max_players
        const maxPlayers = 8;
        const totalPlayersAfterJoining = game._count.game_players + uniqueUserIds.length;
        if (totalPlayersAfterJoining > maxPlayers) {
            throw new BadRequestException(
                `Cannot add ${uniqueUserIds.length} users. Game allows maximum ${maxPlayers} players. Currently has ${game._count.game_players} players.`
            );
        }

        // Check if any users are already in the game
        const existingPlayers = await this.prisma.gamePlayer.findMany({
            where: {
                game_id: joinGameDto.game_id,
                user_id: { in: uniqueUserIds }
            },
            select: {
                user_id: true,
                user: {
                    select: {
                        name: true,
                        email: true
                    }
                }
            }
        });

        if (existingPlayers.length > 0) {
            const existingUserNames = existingPlayers.map(p => p.user.name || p.user.email).join(', ');
            throw new BadRequestException(`Some users are already in this game: ${existingUserNames}`);
        }

        // Verify all user IDs exist
        const users = await this.prisma.user.findMany({
            where: { id: { in: uniqueUserIds } },
            select: {
                id: true,
                name: true,
                email: true,
                avatar: true,
            }
        });

        if (users.length !== uniqueUserIds.length) {
            const foundUserIds = users.map(u => u.id);
            const missingUserIds = uniqueUserIds.filter(id => !foundUserIds.includes(id));
            throw new BadRequestException(`Some users not found: ${missingUserIds.join(', ')}`);
        }

        // Handle room joining if room_code is provided
        let roomId = null;
        if (joinGameDto.room_code) {
            const room = await this.prisma.room.findUnique({
                where: { code: joinGameDto.room_code },
                include: { game: true }
            });

            if (!room || room.game_id !== joinGameDto.game_id) {
                throw new BadRequestException('Invalid room code for this game');
            }
            roomId = room.id;
        }

        // Create game players for all users (host first, then others)
        const sortedUserIds = [userId, ...uniqueUserIds.filter(id => id !== userId)];
        const gamePlayersData = sortedUserIds.map((playerId, index) => ({
            game_id: joinGameDto.game_id,
            user_id: playerId,
            room_id: roomId,
            player_order: game._count.game_players + index + 1,
        }));

        // Use transaction to ensure all players are added or none
        const result = await this.prisma.$transaction(async (tx) => {
            // Create all game players
            const createdPlayers = await Promise.all(
                gamePlayersData.map(data =>
                    tx.gamePlayer.create({
                        data,
                        select: {
                            id: true,
                            game_id: true,
                            user_id: true,
                            room_id: true,
                            score: true,
                            correct_answers: true,
                            wrong_answers: true,
                            skipped_answers: true,
                            player_order: true,
                            final_rank: true,
                            created_at: true,
                            updated_at: true,
                            user: {
                                select: {
                                    id: true,
                                    name: true,
                                    email: true,
                                    avatar: true,
                                }
                            }
                        }
                    })
                )
            );

            // Set game to active
            await tx.game.update({
                where: { id: joinGameDto.game_id },
                data: {
                    status: 'active'
                }
            });

            return createdPlayers;
        });

        // Get updated game info
        const updatedGame = await this.prisma.game.findUnique({
            where: { id: joinGameDto.game_id },
            include: {
                _count: {
                    select: { game_players: true }
                }
            }
        });

        const hostPlayer = result.find(p => p.user_id === userId);

        return {
            success: true,
            message: `Host joined and added ${uniqueUserIds.length - 1} additional players to the game`,
            data: {
                game: updatedGame,
                host_player: hostPlayer,
                all_players: result,
                total_players: uniqueUserIds.length,
                remaining_slots: 8 - updatedGame._count.game_players,
                is_host: true,
                added_players: result.filter(p => p.user_id !== userId),
            },
        };
    }

    // Leave a game
    async leaveGame(userId: string, leaveGameDto: LeaveGameDto) {
        try {
            const gamePlayer = await this.prisma.gamePlayer.findFirst({
                where: {
                    game_id: leaveGameDto.game_id,
                    user_id: userId
                }
            });

            if (!gamePlayer) {
                throw new NotFoundException('Player not found in this game');
            }

            await this.prisma.gamePlayer.delete({
                where: { id: gamePlayer.id }
            });

            // Game player count is automatically managed by the relation

            return {
                success: true,
                message: 'Successfully left the game',
            };
        } catch (error) {
            return {
                success: false,
                message: `Error leaving game: ${error.message}`,
            };
        }
    }

    // Get player's game statistics
    async getPlayerStats(userId: string, gameId: string) {
        try {
            const gamePlayer = await this.prisma.gamePlayer.findFirst({
                where: {
                    game_id: gameId,
                    user_id: userId
                },
                select: {
                    id: true,
                    score: true,
                    correct_answers: true,
                    wrong_answers: true,
                    skipped_answers: true,
                    player_order: true,
                    final_rank: true,
                    created_at: true,
                    updated_at: true,
                    user: {
                        select: {
                            id: true,
                            name: true,
                            email: true,
                            avatar: true,
                        }
                    },
                    game: {
                        select: {
                            id: true,
                            mode: true,
                        }
                    }
                }
            });

            if (!gamePlayer) {
                throw new NotFoundException('Player not found in this game');
            }

            return {
                success: true,
                message: 'Player statistics retrieved successfully',
                data: gamePlayer,
            };
        } catch (error) {
            return {
                success: false,
                message: `Error fetching player statistics: ${error.message}`,
            };
        }
    }

    // Get all players in a game
    async getGamePlayers(gameId: string) {
        try {
            const players = await this.prisma.gamePlayer.findMany({
                where: { game_id: gameId },
                select: {
                    id: true,
                    score: true,
                    correct_answers: true,
                    wrong_answers: true,
                    skipped_answers: true,
                    player_order: true,
                    final_rank: true,
                    created_at: true,
                    user: {
                        select: {
                            id: true,
                            name: true,
                            email: true,
                            avatar: true,
                        }
                    },
                    game: {
                        select: {
                            id: true,
                            mode: true,
                        }
                    },
                },
                orderBy: [
                    { final_rank: 'asc' },
                    { score: 'desc' },
                    { player_order: 'asc' }
                ]
            });

            return {
                success: true,
                message: 'Game players retrieved successfully',
                data: players,
            };
        } catch (error) {
            return {
                success: false,
                message: `Error fetching game players: ${error.message}`,
            };
        }
    }

    // Answer a question (for gameplay)
    async answerQuestion(userId: string, gameId: string, answerDto: AnswerQuestionDto) {
        try {
            const gamePlayer = await this.prisma.gamePlayer.findFirst({
                where: {
                    game_id: gameId,
                    user_id: userId
                }
            });

            if (!gamePlayer) {
                throw new NotFoundException('Player not found in this game');
            }

            // Get question with answers
            const question = await this.prisma.question.findUnique({
                where: { id: answerDto.question_id },
                include: { answers: true }
            });

            if (!question) {
                throw new NotFoundException('Question not found');
            }

            // Find the selected answer
            const selectedAnswer = question.answers.find(a => a.id === answerDto.answer_id);
            if (!selectedAnswer) {
                throw new BadRequestException('Invalid answer selected');
            }

            // Check if already answered
            const existingAnswer = await this.prisma.playerAnswer.findFirst({
                where: {
                    game_player_id: gamePlayer.id,
                    question_id: answerDto.question_id
                }
            });

            if (existingAnswer) {
                throw new BadRequestException('Question already answered');
            }

            // Create player answer
            await this.prisma.playerAnswer.create({
                data: {
                    game_player_id: gamePlayer.id,
                    question_id: answerDto.question_id,
                    answer_id: answerDto.answer_id,
                    isCorrect: selectedAnswer.is_correct,
                }
            });

            // Update player stats
            const pointsEarned = selectedAnswer.is_correct ? question.points : 0;
            const updatedPlayer = await this.prisma.gamePlayer.update({
                where: { id: gamePlayer.id },
                data: {
                    score: { increment: pointsEarned },
                    ...(selectedAnswer.is_correct
                        ? { correct_answers: { increment: 1 } }
                        : { wrong_answers: { increment: 1 } }
                    )
                }
            });

            return {
                success: true,
                message: selectedAnswer.is_correct ? 'Correct!' : 'Incorrect!',
                data: {
                    is_correct: selectedAnswer.is_correct,
                    points_earned: pointsEarned,
                    current_score: updatedPlayer.score,
                    correct_answer: selectedAnswer.is_correct ? null : question.answers.find(a => a.is_correct)
                },
            };
        } catch (error) {
            return {
                success: false,
                message: `Error answering question: ${error.message}`,
            };
        }
    }

    // Skip a question
    async skipQuestion(userId: string, gameId: string, skipDto: SkipQuestionDto) {
        try {
            const gamePlayer = await this.prisma.gamePlayer.findFirst({
                where: {
                    game_id: gameId,
                    user_id: userId
                }
            });

            if (!gamePlayer) {
                throw new NotFoundException('Player not found in this game');
            }

            await this.prisma.gamePlayer.update({
                where: { id: gamePlayer.id },
                data: {
                    skipped_answers: { increment: 1 }
                }
            });

            return {
                success: true,
                message: 'Question skipped',
            };
        } catch (error) {
            return {
                success: false,
                message: `Error skipping question: ${error.message}`,
            };
        }
    }

    // Get all available categories for a game
    async getGameCategories(gameId: string) {
        try {
            const game = await this.prisma.game.findUnique({
                where: { id: gameId },
                include: {
                    language: {
                        select: {
                            id: true,
                            name: true,
                            code: true,
                        }
                    },
                }
            });

            if (!game) {
                throw new NotFoundException('Game not found');
            }

            const categories = await this.prisma.category.findMany({
                where: {
                    language_id: game.language_id,
                },
                include: {
                    _count: {
                        select: {
                            questions: true
                        }
                    }
                }
            });

            return {
                success: true,
                message: 'Game categories retrieved successfully',
                data: {
                    game_info: {
                        id: game.id,
                        mode: game.mode,
                        status: game.status,
                        language: game.language,
                    },
                    categories: categories.map(category => ({
                        id: category.id,
                        name: category.name,
                        image: category.image,
                        total_questions: category._count.questions,
                    })),
                    total_categories: categories.length,
                },
            };
        } catch (error) {
            return {
                success: false,
                message: `Error fetching game categories: ${error.message}`,
            };
        }
    }

    // Start game - just initialize the game
    async startGame(userId: string, startGameDto: StartGameDto) {
        try {
            // Verify user is in the game
            const gamePlayer = await this.prisma.gamePlayer.findFirst({
                where: {
                    game_id: startGameDto.game_id,
                    user_id: userId
                }
            });

            if (!gamePlayer) {
                throw new NotFoundException('Player not found in this game');
            }

            // Update game status to in_progress
            await this.prisma.game.update({
                where: { id: startGameDto.game_id },
                data: { status: 'in_progress' }
            });

            // Get game info
            const game = await this.prisma.game.findUnique({
                where: { id: startGameDto.game_id },
                include: {
                    language: {
                        select: {
                            id: true,
                            name: true,
                            code: true,
                        }
                    },
                    game_players: {
                        select: {
                            id: true,
                            score: true,
                            player_order: true,
                            user: {
                                select: {
                                    id: true,
                                    name: true,
                                    email: true,
                                    avatar: true,
                                }
                            }
                        },
                        orderBy: {
                            player_order: 'asc'
                        }
                    }
                }
            });

            return {
                success: true,
                message: 'Game started successfully',
                data: {
                    game_info: {
                        id: game.id,
                        mode: game.mode,
                        status: 'in_progress',
                        max_players: 8,
                        current_players: game.game_players.length,
                        language: game.language,
                    },
                    players: game.game_players,
                    current_player: gamePlayer,
                    message: 'Game is now ready. Use get-questions endpoint to fetch questions with your selections.'
                },
            };
        } catch (error) {
            return {
                success: false,
                message: `Error starting game: ${error.message}`,
            };
        }
    }

    // Get questions with category, difficulty, and question count selection
    async getGameQuestions(userId: string, gameId: string, questionsDto: GetGameQuestionsDto) {
        try {
            // Verify user is in the game
            const gamePlayer = await this.prisma.gamePlayer.findFirst({
                where: {
                    game_id: gameId,
                    user_id: userId
                }
            });

            if (!gamePlayer) {
                throw new NotFoundException('Player not found in this game');
            }

            // Verify category belongs to the game
            const category = await this.prisma.category.findFirst({
                where: {
                    id: questionsDto.category_id,
                },
                include: {
                    language: {
                        select: {
                            id: true,
                            name: true,
                            code: true,
                        }
                    }
                }
            });

            if (!category) {
                throw new NotFoundException('Category not found in this game');
            }

            // Get questions based on selection
            const whereClause = {
                category_id: questionsDto.category_id,
                difficulty_id: questionsDto.difficulty_id,
            };

            const totalAvailableQuestions = await this.prisma.question.count({
                where: whereClause
            });

            if (totalAvailableQuestions === 0) {
                throw new NotFoundException('No questions found for selected category and difficulty');
            }

            // Determine how many questions to fetch (default to 10, max 10)
            const questionLimit = questionsDto.question_count
                ? Math.min(questionsDto.question_count, 10, totalAvailableQuestions)
                : Math.min(10, totalAvailableQuestions);

            // Get all question IDs first for random selection
            const allQuestionIds = await this.prisma.question.findMany({
                where: whereClause,
                select: {
                    id: true,
                }
            });

            // Randomly shuffle and select the required number of questions
            const shuffledIds = allQuestionIds.sort(() => 0.5 - Math.random());
            const selectedIds = shuffledIds.slice(0, questionLimit).map(q => q.id);

            // Fetch the selected questions with full details
            const questions = await this.prisma.question.findMany({
                where: {
                    id: {
                        in: selectedIds
                    }
                },
                select: {
                    id: true,
                    text: true,
                    points: true,
                    time: true,
                    file_url: true,
                    difficulty: {
                        select: {
                            id: true,
                            name: true,
                        }
                    },
                    question_type: {
                        select: {
                            id: true,
                            name: true,
                        }
                    },
                    answers: {
                        select: {
                            id: true,
                            text: true,
                            file_url: true,
                            // Don't include is_correct for security
                        }
                    }
                },
                orderBy: {
                    points: 'asc' // Still order by points for consistency
                }
            });

            // Add file URLs for questions and answers
            for (const question of questions) {
                if (question.file_url) {
                    question['file_url'] = SojebStorage.url(appConfig().storageUrl.question + question.file_url);
                }
                if (question.answers && question.answers.length > 0) {
                    for (const answer of question.answers) {
                        if (answer.file_url) {
                            answer['file_url'] = SojebStorage.url(appConfig().storageUrl.answer + answer.file_url);
                        }
                    }
                }
            }

            return {
                success: true,
                message: 'Questions retrieved successfully',
                data: {
                    selected_criteria: {
                        category: {
                            id: category.id,
                            name: category.name,
                            image: category.image,
                        },
                        difficulty: questions[0]?.difficulty || null,
                        requested_questions: questionsDto.question_count || 'all',
                        actual_questions: questions.length,
                        total_available: totalAvailableQuestions,
                    },
                    questions: questions.map((question, index) => ({
                        question_number: index + 1,
                        id: question.id,
                        text: question.text,
                        points: question.points,
                        time_limit: question.time,
                        file_url: question.file_url,
                        difficulty: question.difficulty,
                        question_type: question.question_type,
                        answers: question.answers,
                        is_answered: false, // Initially all questions are unanswered
                    })),
                    total_questions: questions.length,
                },
            };
        } catch (error) {
            return {
                success: false,
                message: `Error fetching questions: ${error.message}`,
            };
        }
    }

    // End game - calculate final rankings and create leaderboard entries
    async endGame(userId: string, endGameDto: EndGameDto) {
        try {
            // Verify user is in the game
            const gamePlayer = await this.prisma.gamePlayer.findFirst({
                where: {
                    game_id: endGameDto.game_id,
                    user_id: userId
                }
            });

            if (!gamePlayer) {
                throw new NotFoundException('Player not found in this game');
            }

            // Check if game is already completed
            const game = await this.prisma.game.findUnique({
                where: { id: endGameDto.game_id },
                include: {
                    language: {
                        select: {
                            id: true,
                            name: true,
                            code: true,
                        }
                    }
                }
            });

            if (!game) {
                throw new NotFoundException('Game not found');
            }

            if (game.status === 'completed') {
                // Game already ended, just return the results
                return await this.getGameResults(endGameDto.game_id);
            }

            // Get all players in the game
            const allPlayers = await this.prisma.gamePlayer.findMany({
                where: { game_id: endGameDto.game_id },
                include: {
                    user: {
                        select: {
                            id: true,
                            name: true,
                            email: true,
                            avatar: true,
                        }
                    }
                },
                orderBy: [
                    { score: 'desc' },
                    { correct_answers: 'desc' },
                    { player_order: 'asc' }
                ]
            });

            // Calculate final rankings
            let currentRank = 1;
            let previousScore = null;
            let previousCorrect = null;
            const rankedPlayers = [];

            for (let i = 0; i < allPlayers.length; i++) {
                const player = allPlayers[i];

                // If score and correct answers are different from previous player, update rank
                if (previousScore !== null &&
                    (player.score !== previousScore || player.correct_answers !== previousCorrect)) {
                    currentRank = i + 1;
                }

                // Update player's final rank in database
                await this.prisma.gamePlayer.update({
                    where: { id: player.id },
                    data: { final_rank: currentRank }
                });

                rankedPlayers.push({
                    ...player,
                    final_rank: currentRank
                });

                previousScore = player.score;
                previousCorrect = player.correct_answers;
            }

            // Update game status to completed
            await this.prisma.game.update({
                where: { id: endGameDto.game_id },
                data: { status: 'completed' }
            });

            // Create leaderboard entries for all players
            const leaderboardPromises = rankedPlayers.map(async (player) => {
                // Check if leaderboard entry already exists for this user and game
                const existingEntry = await this.prisma.leaderboard.findFirst({
                    where: {
                        user_id: player.user_id,
                        game_id: endGameDto.game_id
                    }
                });

                if (!existingEntry) {
                    return this.prisma.leaderboard.create({
                        data: {
                            user_id: player.user_id,
                            game_id: endGameDto.game_id,
                            score: player.score,
                            correct: player.correct_answers,
                            wrong: player.wrong_answers,
                            skipped: player.skipped_answers,
                            games_played: 1,
                            mode: game.mode,
                        }
                    });
                }
                return existingEntry;
            });

            await Promise.all(leaderboardPromises);

            // Get comprehensive game results
            const gameResults = await this.getGameResults(endGameDto.game_id);

            return {
                success: true,
                message: 'Game ended successfully',
                data: {
                    ...gameResults.data,
                    game_status: 'completed',
                    end_time: new Date(),
                }
            };

        } catch (error) {
            return {
                success: false,
                message: `Error ending game: ${error.message}`,
            };
        }
    }

    // Get comprehensive game results with rankings and leaderboard
    async getGameResults(gameId: string) {
        try {
            const game = await this.prisma.game.findUnique({
                where: { id: gameId },
                include: {
                    language: {
                        select: {
                            id: true,
                            name: true,
                            code: true,
                        }
                    }
                }
            });

            if (!game) {
                throw new NotFoundException('Game not found');
            }

            // Get final rankings
            const finalRankings = await this.prisma.gamePlayer.findMany({
                where: { game_id: gameId },
                include: {
                    user: {
                        select: {
                            id: true,
                            name: true,
                            email: true,
                            avatar: true,
                        }
                    }
                },
                orderBy: [
                    { final_rank: 'asc' },
                    { score: 'desc' },
                    { correct_answers: 'desc' },
                    { player_order: 'asc' }
                ]
            });

            // Get leaderboard entries for this game
            const leaderboardEntries = await this.prisma.leaderboard.findMany({
                where: { game_id: gameId },
                include: {
                    user: {
                        select: {
                            id: true,
                            name: true,
                            email: true,
                            avatar: true,
                        }
                    }
                },
                orderBy: [
                    { score: 'desc' },
                    { correct: 'desc' },
                    { created_at: 'asc' }
                ]
            });

            // Calculate statistics
            const totalQuestions = finalRankings.reduce((sum, player) =>
                sum + player.correct_answers + player.wrong_answers + player.skipped_answers, 0
            ) / finalRankings.length;

            const averageScore = finalRankings.reduce((sum, player) => sum + player.score, 0) / finalRankings.length;

            const topPerformer = finalRankings[0];
            const winner = finalRankings.find(player => player.final_rank === 1);

            return {
                success: true,
                message: 'Game results retrieved successfully',
                data: {
                    game_info: {
                        id: game.id,
                        mode: game.mode,
                        status: game.status,
                        language: game.language,
                        total_players: finalRankings.length,
                        max_players: 8,
                    },
                    final_rankings: finalRankings.map((player, index) => ({
                        position: player.final_rank || (index + 1),
                        player_id: player.id,
                        user: player.user,
                        score: player.score,
                        correct_answers: player.correct_answers,
                        wrong_answers: player.wrong_answers,
                        skipped_answers: player.skipped_answers,
                        total_questions: player.correct_answers + player.wrong_answers + player.skipped_answers,
                        accuracy: player.correct_answers + player.wrong_answers > 0
                            ? ((player.correct_answers / (player.correct_answers + player.wrong_answers)) * 100).toFixed(2) + '%'
                            : '0%',
                        player_order: player.player_order,
                        created_at: player.created_at,
                    })),
                    leaderboard: leaderboardEntries.map((entry, index) => ({
                        leaderboard_position: index + 1,
                        user: entry.user,
                        score: entry.score,
                        correct: entry.correct,
                        wrong: entry.wrong,
                        skipped: entry.skipped,
                        games_played: entry.games_played,
                        mode: entry.mode,
                        created_at: entry.created_at,
                    })),
                    game_statistics: {
                        winner: winner ? {
                            user: winner.user,
                            score: winner.score,
                            accuracy: winner.correct_answers + winner.wrong_answers > 0
                                ? ((winner.correct_answers / (winner.correct_answers + winner.wrong_answers)) * 100).toFixed(2) + '%'
                                : '0%'
                        } : null,
                        top_performer: topPerformer ? {
                            user: topPerformer.user,
                            score: topPerformer.score,
                            correct_answers: topPerformer.correct_answers,
                        } : null,
                        average_score: Math.round(averageScore * 100) / 100,
                        total_questions_per_player: Math.round(totalQuestions),
                        completion_rate: finalRankings.length > 0 ? '100%' : '0%',
                    },
                    podium: {
                        first_place: finalRankings.find(p => p.final_rank === 1) || null,
                        second_place: finalRankings.find(p => p.final_rank === 2) || null,
                        third_place: finalRankings.find(p => p.final_rank === 3) || null,
                    }
                }
            };

        } catch (error) {
            return {
                success: false,
                message: `Error fetching game results: ${error.message}`,
            };
        }
    }

}