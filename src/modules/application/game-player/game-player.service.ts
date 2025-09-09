import { Injectable, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateGamePlayerDto } from './dto/create-game-player.dto';
import { UpdateGamePlayerDto } from './dto/update-game-player.dto';
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
            // Check if game exists and is active
            const game = await this.prisma.game.findUnique({
                where: { id: joinGameDto.game_id },
                include: {
                    _count: {
                        select: { game_players: true }
                    }
                }
            });

            if (!game) {
                throw new NotFoundException('Game not found');
            }

            if (game.status !== 'active') {
                throw new BadRequestException('Game is not active');
            }

            // Check if game is full
            if (game._count.game_players >= game.max_players) {
                throw new BadRequestException('Game is full');
            }

            // Check if user is already in the game
            const existingPlayer = await this.prisma.gamePlayer.findFirst({
                where: {
                    game_id: joinGameDto.game_id,
                    user_id: userId
                }
            });

            if (existingPlayer) {
                throw new BadRequestException('User already in this game');
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
                            max_players: true,
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
                where: { id: joinGameDto.game_id },
                data: { player_count: { increment: 1 } }
            });

            return {
                success: true,
                message: 'Successfully joined the game',
                data: gamePlayer,
            };
        } catch (error) {
            return {
                success: false,
                message: `Error joining game: ${error.message}`,
            };
        }
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

            await this.prisma.game.update({
                where: { id: leaveGameDto.game_id },
                data: { player_count: { decrement: 1 } }
            });

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
                            player_count: true,
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
                            player_count: true,
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
                    categories: {
                        select: {
                            id: true,
                            name: true,
                            image: true,
                            language_id: true,
                            _count: {
                                select: {
                                    questions: true
                                }
                            }
                        }
                    }
                }
            });

            if (!game) {
                throw new NotFoundException('Game not found');
            }

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
                    categories: game.categories.map(category => ({
                        id: category.id,
                        name: category.name,
                        image: category.image,
                        total_questions: category._count.questions,
                    })),
                    total_categories: game.categories.length,
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
                        max_players: game.max_players,
                        current_players: game.player_count,
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
                    game_id: gameId
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

}