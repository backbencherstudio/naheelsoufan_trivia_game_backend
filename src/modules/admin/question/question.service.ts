import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateQuestionDto } from './dto/create-question.dto';
import { SojebStorage } from 'src/common/lib/Disk/SojebStorage';
import { StringHelper } from 'src/common/helper/string.helper';
import appConfig from 'src/config/app.config';
import { UpdateQuestionDto } from './dto/update-question.dto';

@Injectable()
export class QuestionService {
  constructor(private readonly prisma: PrismaService) { }

  // Create a new question with answers and file handling
  async create(createQuestionDto: CreateQuestionDto, questionFile: Express.Multer.File, answerFiles: Express.Multer.File[]) {
    try {
      const { answers, ...questionData } = createQuestionDto;

      // Handle file upload for the question
      if (questionFile) {
        const questionFileName = StringHelper.generateRandomFileName(questionFile.originalname);
        await SojebStorage.put(appConfig().storageUrl.question + questionFileName, questionFile.buffer);
        questionData.file_url = questionFileName;  // Set file URL for the question
      }

      // Create the question first
      const question = await this.prisma.question.create({
        data: {
          ...questionData,
        },
        select: {
          id: true,
          text: true,
          file_url: true,
          time: true,
          free_bundle: true,
          firebase: true,
          points: true,
          repeat_count: true,
          created_at: true,
          updated_at: true,
          category: { select: { id: true, name: true } },
          language: { select: { id: true, name: true } },
          difficulty: { select: { id: true, name: true } },
          question_type: { select: { id: true, name: true } },
        },
      });
      // Handle file uploads for the answers using map
      if (answers && answers.length > 0) {
        const answersData = answers.map((answer, index) => {
          if (answerFiles[index]) {
            const answerFileName = StringHelper.generateRandomFileName(answerFiles[index].originalname);
            SojebStorage.put(appConfig().storageUrl.answer + answerFileName, answerFiles[index].buffer);
            answer.file_url = answerFileName;
          }

          return {
            ...answer,
            question_id: question.id,  // Link the answer to the created question
          };
        });

        // Create the answers in the database
        await this.prisma.answer.createMany({
          data: answersData,
        });
      }

      // question file get
      if (question.file_url) {
        question['question_file_url'] = SojebStorage.url(appConfig().storageUrl.question + question.file_url);
      }
      // answers file get
      if (answers && answers.length > 0) {
        for (const answer of answers) {
          if (answer.file_url) {
            answer['answer_file_url'] = SojebStorage.url(appConfig().storageUrl.answer + answer.file_url);
          }
        }
      }

      return {
        success: true,
        message: 'Question and answers created successfully',
        data: {
          question: question,
          answers: answers || [],
        },
      };
    } catch (error) {
      return {
        success: false,
        message: `Error creating question and answers: ${error.message}`,
      };
    }
  }

  async findAll(q: string, page: number, limit: number, sort: string, order: string, filter: any) {
    try {
      const skip = (page - 1) * limit;

      // Construct the search filter based on query
      const searchFilter = {};

      if (q) {
        searchFilter['OR'] = [
          { text: { contains: q, mode: 'insensitive' } },
          { answers: { some: { text: { contains: q, mode: 'insensitive' } } } },
        ];
      }

      // Apply additional filters like category, language, difficulty, question type
      if (filter) {
        if (filter.category_id) searchFilter['category_id'] = filter.category_id;
        if (filter.language_id) searchFilter['language_id'] = filter.language_id;
        if (filter.difficulty_id) searchFilter['difficulty_id'] = filter.difficulty_id;
        if (filter.question_type_id) searchFilter['question_type_id'] = filter.question_type_id;
      }

      // Count total records for pagination
      const total = await this.prisma.question.count({ where: searchFilter });

      // Build orderBy supporting related fields (category, difficulty, language)
      const direction: Prisma.SortOrder = (order || 'desc').toLowerCase() === 'asc' ? 'asc' : 'desc';
      const relationOrder: Prisma.QuestionOrderByWithRelationInput =
        sort === 'category' ? { category: { name: direction } } :
          sort === 'difficulty' ? { difficulty: { name: direction } } :
            sort === 'language' ? { language: { name: direction } } : {};

      const scalarSortField = ['text', 'created_at', 'updated_at', 'points', 'time'].includes(sort)
        ? sort
        : 'created_at';

      const orderByClause: Prisma.QuestionOrderByWithRelationInput =
        Object.keys(relationOrder).length > 0
          ? relationOrder
          : { [scalarSortField]: direction } as Prisma.QuestionOrderByWithRelationInput;

      // Query the questions with pagination, sorting, and filtering
      const questions = await this.prisma.question.findMany({
        where: searchFilter,
        skip: skip,
        take: limit,
        orderBy: orderByClause,
        select: {
          id: true,
          text: true,
          file_url: true,
          time: true,
          free_bundle: true,
          firebase: true,
          points: true,
          repeat_count: true,
          created_at: true,
          updated_at: true,
          category: { select: { id: true, name: true } },
          language: { select: { id: true, name: true } },
          difficulty: { select: { id: true, name: true } },
          question_type: { select: { id: true, name: true } },
          answers: { select: { id: true, text: true, is_correct: true, file_url: true } },
        },
      });

      // Add file URLs for questions and answers
      for (const question of questions) {
        if (question.file_url) {
          question['question_file_url'] = SojebStorage.url(appConfig().storageUrl.question + question.file_url);
        }
        if (question.answers && question.answers.length > 0) {
          for (const answer of question.answers) {
            if (answer.file_url) {
              answer['answer_file_url'] = SojebStorage.url(appConfig().storageUrl.answer + answer.file_url);
            }
          }
        }

          // Count how many times this question was used in games
          const selectionCount = await this.prisma.gameQuestion.count({
            where: {
              question_id: question.id,
            },
          });
          question['selection_count'] = selectionCount;
      }

      // Pagination metadata calculation
      const totalPages = Math.ceil(total / limit);
      const hasNextPage = page < totalPages;
      const hasPreviousPage = page > 1;

      return {
        success: true,
        message: questions.length ? 'Questions retrieved successfully' : 'No questions found',
        data: questions,
        pagination: {
          total: total,
          page: page,
          limit: limit,
          totalPages: totalPages,
          hasNextPage: hasNextPage,
          hasPreviousPage: hasPreviousPage,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: `Error fetching questions: ${error.message}`,
      };
    }
  }

  // Get a single question by ID with associated answers and files
  async findOne(id: string) {
    try {
      const question = await this.prisma.question.findUnique({
        where: { id },
        select: {
          id: true,
          text: true,
          file_url: true,
          time: true,
          free_bundle: true,
          firebase: true,
          points: true,
          repeat_count: true,
          created_at: true,
          updated_at: true,
          category: {
            select: {
              id: true,
              name: true,
            },
          },
          language: {
            select: {
              id: true,
              name: true,
            },
          },
          difficulty: {
            select: {
              id: true,
              name: true,
            },
          },
          question_type: {
            select: {
              id: true,
              name: true,
            },
          },
          answers: {
            select: {
              id: true,
              text: true,
              is_correct: true,
              file_url: true,
            },
          },
        },
      });

      // Check if the question exists and then process the file URL for the question
      if (question) {
        if (question.file_url) {
          question['question_file_url'] = SojebStorage.url(appConfig().storageUrl.question + question.file_url);
        }

        // Loop through the answers to append the file URL
        if (question.answers && question.answers.length > 0) {
          for (const answer of question.answers) {
            if (answer.file_url) {
              answer['answer_file_url'] = SojebStorage.url(appConfig().storageUrl.answer + answer.file_url);
            }
          }
        }

        return {
          success: true,
          message: 'Question retrieved successfully',
          data: question,
        };
      } else {
        return {
          success: false,
          message: 'Question not found',
        };
      }
    } catch (error) {
      return {
        success: false,
        message: `Error fetching question: ${error.message}`,
      };
    }
  }


  // Update an existing question and its answers with file handling
  async update(id: string, updateQuestionDto: UpdateQuestionDto, questionFile: Express.Multer.File, answerFiles: Express.Multer.File[]) {
    try {
      const { answers, ...questionData } = updateQuestionDto;

      // Handle file upload for the question (if provided)
      if (questionFile) {
        const questionFileName = StringHelper.generateRandomFileName(questionFile.originalname);
        await SojebStorage.put(appConfig().storageUrl.question + questionFileName, questionFile.buffer);
        questionData.file_url = questionFileName;
      }

      // Update the question
      const updatedQuestion = await this.prisma.question.update({
        where: { id },
        data: {
          ...questionData,
        },
        select: {
          id: true,
          text: true,
          file_url: true,
          time: true,
          free_bundle: true,
          firebase: true,
          points: true,
          repeat_count: true,
          created_at: true,
          updated_at: true,
        },
      });
      // If answers are provided, update them as well
      if (answers && answers.length > 0) {
        // Delete existing answers associated with this question
        await this.prisma.answer.deleteMany({
          where: { question_id: id },
        });

        // Handle file uploads for answers and update the answers data
        const answersData = answers.map((answer, index) => {
          let answerFileUrl = null;
          if (answerFiles[index]) {
            const answerFileName = StringHelper.generateRandomFileName(answerFiles[index].originalname);
            SojebStorage.put(appConfig().storageUrl.answer + answerFileName, answerFiles[index].buffer);
            answerFileUrl = answerFileName;
          }

          return {
            ...answer,
            question_id: updatedQuestion.id,  // Link the answer to the updated question
            file_url: answerFileUrl,          // Set file URL for the answer
          };
        });

        // Create the updated answers
        await this.prisma.answer.createMany({
          data: answersData,
        });
      }

      // add question file url
      if (updatedQuestion.file_url) {
        updatedQuestion['question_file_url'] = SojebStorage.url(appConfig().storageUrl.question + updatedQuestion.file_url);
      }


      return {
        success: true,
        message: 'Question and answers updated successfully',
        data: updatedQuestion,
      };
    } catch (error) {
      return {
        success: false,
        message: `Error updating question and answers: ${error.message}`,
      };
    }
  }

  // Delete a question and its associated answers, and handle file deletion
  async remove(id: string) {
    try {
      // Retrieve question and answers first
      const question = await this.prisma.question.findUnique({
        where: { id },
        select: {
          id: true,
          file_url: true,
          answers: {
            select: {
              id: true,
              file_url: true,
            },
          },
        },
      });

      if (!question) {
        throw new Error('Question not found');
      }

      // Delete answer files from storage
      if (question.answers && question.answers.length > 0) {
        for (const answer of question.answers) {
          if (answer.file_url) {
            await SojebStorage.delete(appConfig().storageUrl.answer + answer.file_url);
          }
        }
      }

      // Delete the question file from storage
      if (question.file_url) {
        await SojebStorage.delete(appConfig().storageUrl.question + question.file_url);
      }

      // Delete the answers from the database
      await this.prisma.answer.deleteMany({
        where: { question_id: id },
      });

      // Delete the question
      const deletedQuestion = await this.prisma.question.delete({
        where: { id },
        select: {
          id: true,
          text: true,
        },
      });

      return {
        success: true,
        message: 'Question and associated answers deleted successfully',
        data: deletedQuestion,
      };
    } catch (error) {
      return {
        success: false,
        message: `Error deleting question and answers: ${error.message}`,
      };
    }
  }

  // OLD IMPORT METHOD - COMMENTED OUT
  async oldImportQuestions(file: Express.Multer.File) {
    const FILE_DOWNLOAD_TIMEOUT = 30000; // 30 seconds timeout per file download

    try {
      // Validate file type
      if (!file.mimetype.includes('json') && !file.originalname.endsWith('.json')) {
        throw new Error('Only JSON files are allowed for question import');
      }

      // Parse JSON content
      let questionsData;
      try {
        const fileContent = file.buffer.toString('utf8');
        questionsData = JSON.parse(fileContent);
      } catch (jsonError) {
        throw new Error('Invalid JSON file format');
      }

      // Validate JSON structure
      if (!Array.isArray(questionsData)) {
        throw new Error('JSON file must contain an array of questions');
      }

      let successCount = 0;
      let errorCount = 0;
      const errors = [];

      // Process each question
      for (let i = 0; i < questionsData.length; i++) {
        const questionData = questionsData[i];

        try {
          // Validate required fields
          if (!questionData.text || !questionData.language || !questionData.category ||
            !questionData.difficulty || !questionData.question_type) {
            throw new Error(`Missing required fields in question ${i + 1}`);
          }

          // Handle language - find existing or create new
          let languageId;
          const existingLanguage = await this.prisma.language.findFirst({
            where: { name: questionData.language }
          });

          if (existingLanguage) {
            languageId = existingLanguage.id;
          } else {
            // Create new language with default code
            const newLanguage = await this.prisma.language.create({
              data: {
                name: questionData.language,
                code: questionData.language.toLowerCase().substring(0, 2),
              },
            });
            languageId = newLanguage.id;
          }

          // Handle category - find existing or create new
          let categoryId;
          const existingCategory = await this.prisma.category.findFirst({
            where: {
              name: questionData.category,
              language_id: languageId
            }
          });

          if (existingCategory) {
            categoryId = existingCategory.id;
          } else {
            // Create new category
            const newCategory = await this.prisma.category.create({
              data: {
                name: questionData.category,
                language_id: languageId,
              },
            });
            categoryId = newCategory.id;
          }

          // Handle difficulty - find existing or create new
          let difficultyId;
          const existingDifficulty = await this.prisma.difficulty.findFirst({
            where: {
              name: questionData.difficulty,
              language_id: languageId
            }
          });

          if (existingDifficulty) {
            difficultyId = existingDifficulty.id;
          } else {
            // Create new difficulty with default points
            const defaultPoints = this.getDefaultPoints(questionData.difficulty);
            const newDifficulty = await this.prisma.difficulty.create({
              data: {
                name: questionData.difficulty,
                language_id: languageId,
                points: questionData.points || defaultPoints,
              },
            });
            difficultyId = newDifficulty.id;
          }

          // Handle question type - find existing or create new
          let questionTypeId;
          const existingQuestionType = await this.prisma.questionType.findFirst({
            where: {
              name: questionData.question_type,
            }
          });

          if (existingQuestionType) {
            questionTypeId = existingQuestionType.id;
          } else {
            // Create new question type
            const newQuestionType = await this.prisma.questionType.create({
              data: {
                name: questionData.question_type,
                language_id: languageId,
              },
            });
            questionTypeId = newQuestionType.id;
          }

          // Handle question file_url - download and store if provided
          let fileUrl = null;
          const imageUrlField = questionData.question_file_url || questionData.file;
          if (imageUrlField && typeof imageUrlField === 'string') {
            try {
              const imageUrl = imageUrlField.trim();
              console.log(`[Import] Downloading question file for: "${questionData.text.substring(0, 50)}..."`);

              // Download file with timeout
              const controller = new AbortController();
              const timeoutId = setTimeout(() => controller.abort(), FILE_DOWNLOAD_TIMEOUT);

              let response;
              try {
                response = await fetch(imageUrl, {
                  headers: {
                    'User-Agent': 'Mozilla/5.0 (compatible; Node.js)',
                  },
                  redirect: 'follow',
                  signal: controller.signal,
                });
              } catch (fetchError) {
                throw new Error(`Network error: ${fetchError.message}`);
              } finally {
                clearTimeout(timeoutId);
              }

              if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
              }

              const buffer = await response.arrayBuffer();
              const fileBuffer = Buffer.from(buffer);

              if (fileBuffer.length === 0) {
                throw new Error('Downloaded file is empty');
              }

              console.log(`[Import] Downloaded: ${fileBuffer.length} bytes`);

              // Generate filename: use timestamp + random
              const timestamp = Date.now();
              const randomStr = Math.random().toString(36).substring(2, 8);
              const fileName = `question-${timestamp}-${randomStr}.jpg`;

              // Store file in SojebStorage
              await SojebStorage.put(appConfig().storageUrl.question + fileName, fileBuffer);
              fileUrl = fileName;
              console.log(`[Import] Stored question file: ${fileName}`);
            } catch (fileError) {
              console.warn(`[Import] Failed to download/store question file: ${fileError.message}`);
              // Continue without file
            }
          }

          // Process answers based on question type
          const answers = this.processAnswers(questionData);

          // Create question
          const question = await this.prisma.question.create({
            data: {
              text: questionData.text,
              category_id: categoryId,
              language_id: languageId,
              difficulty_id: difficultyId,
              question_type_id: questionTypeId,
              file_url: fileUrl,
              time: questionData.time || 30,
              points: questionData.points || this.getDefaultPoints(questionData.difficulty),
              free_bundle: questionData.free_bundle || false,
              firebase: questionData.isFirebase || false,
            },
          });

          // Create answers
          if (answers && answers.length > 0) {
            const answersData = answers.map(answer => ({
              text: answer.text,
              is_correct: answer.is_correct,
              question_id: question.id,
              file_url: answer.file_url || null,
            }));

            await this.prisma.answer.createMany({
              data: answersData,
            });
          }

          successCount++;
        } catch (questionError) {
          errorCount++;
          errors.push(`Question ${i + 1}: ${questionError.message}`);
        }
      }

      return {
        success: true,
        message: `Import completed: ${successCount} questions imported successfully, ${errorCount} failed`,
        data: {
          total_processed: questionsData.length,
          successful: successCount,
          failed: errorCount,
          errors: errors,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: `Error importing questions: ${error.message}`,
      };
    }
  }

  // NEW IMPORT METHOD - For the specified data format
  async newImportQuestions(file: Express.Multer.File) {
    try {
      // Validate file type
      if (!file.mimetype.includes('json') && !file.originalname.endsWith('.json')) {
        throw new Error('Only JSON files are allowed for question import');
      }

      // Parse JSON content
      let questionsData;
      try {
        const fileContent = file.buffer.toString('utf8');
        questionsData = JSON.parse(fileContent);
      } catch (jsonError) {
        throw new Error('Invalid JSON file format');
      }

      // Validate JSON structure
      if (!Array.isArray(questionsData)) {
        throw new Error('JSON file must contain an array of questions');
      }

      let successCount = 0;
      let errorCount = 0;
      const errors = [];

      // Process questions in batches to avoid timeout
      const BATCH_SIZE = 10; // Process 10 questions in parallel
      const FILE_DOWNLOAD_TIMEOUT = 30000; // 30 seconds timeout per file download

      for (let batchStart = 0; batchStart < questionsData.length; batchStart += BATCH_SIZE) {
        const batchEnd = Math.min(batchStart + BATCH_SIZE, questionsData.length);
        const batch = questionsData.slice(batchStart, batchEnd);

        // Process batch in parallel
        const batchPromises = batch.map(async (questionData, index) => {
          const questionIndex = batchStart + index;

          try {
            // Validate required fields
            if (!questionData.text || !questionData.language || !questionData.category ||
              !questionData.difficulty || !questionData.question_type || !questionData.answers) {
              throw new Error(`Missing required fields in question ${questionIndex + 1}`);
            }

            // Validate answers array
            if (!Array.isArray(questionData.answers) || questionData.answers.length === 0) {
              throw new Error(`Invalid or empty answers array in question ${questionIndex + 1}`);
            }

            // Handle language - find existing or create new
            let languageId;
            const existingLanguage = await this.prisma.language.findFirst({
              where: { name: questionData.language }
            });

            if (existingLanguage) {
              languageId = existingLanguage.id;
            } else {
              // Create new language with default code
              const newLanguage = await this.prisma.language.create({
                data: {
                  name: questionData.language,
                  code: questionData.language.toLowerCase().substring(0, 2),
                },
              });
              languageId = newLanguage.id;
            }

            // Handle category - find existing or create new
            let categoryId;
            const existingCategory = await this.prisma.category.findFirst({
              where: {
                name: questionData.category,
                language_id: languageId
              }
            });

            if (existingCategory) {
              categoryId = existingCategory.id;
            } else {
              // Create new category
              const newCategory = await this.prisma.category.create({
                data: {
                  name: questionData.category,
                  language_id: languageId,
                },
              });
              categoryId = newCategory.id;
            }

            // Handle difficulty - find existing or create new
            let difficultyId;
            const existingDifficulty = await this.prisma.difficulty.findFirst({
              where: {
                name: questionData.difficulty,
                language_id: languageId
              }
            });

            if (existingDifficulty) {
              difficultyId = existingDifficulty.id;
            } else {
              // Create new difficulty with default points
              const defaultPoints = this.getDefaultPoints(questionData.difficulty);
              const newDifficulty = await this.prisma.difficulty.create({
                data: {
                  name: questionData.difficulty,
                  language_id: languageId,
                  points: questionData.points || defaultPoints,
                },
              });
              difficultyId = newDifficulty.id;
            }

            // Handle question type - find existing or create new
            let questionTypeId;
            const existingQuestionType = await this.prisma.questionType.findFirst({
              where: {
                name: questionData.question_type,
                language_id: languageId
              }
            });

            if (existingQuestionType) {
              questionTypeId = existingQuestionType.id;
            } else {
              // Create new question type
              const newQuestionType = await this.prisma.questionType.create({
                data: {
                  name: questionData.question_type,
                  language_id: languageId,
                },
              });
              questionTypeId = newQuestionType.id;
            }

            // Handle question file_url - download and store if provided
            let fileUrl = null;
            const imageUrlField = questionData.question_file_url || questionData.file_url;
            if (imageUrlField && typeof imageUrlField === 'string') {
              try {
                const imageUrl = imageUrlField.trim();
                console.log(`[Import] Downloading question file for: "${questionData.text.substring(0, 50)}..."`);

                // Download file with timeout
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), FILE_DOWNLOAD_TIMEOUT);

                let response;
                try {
                  response = await fetch(imageUrl, {
                    headers: {
                      'User-Agent': 'Mozilla/5.0 (compatible; Node.js)',
                    },
                    redirect: 'follow',
                    signal: controller.signal,
                  });
                } catch (fetchError) {
                  throw new Error(`Network error: ${fetchError.message}`);
                } finally {
                  clearTimeout(timeoutId);
                }

                if (!response.ok) {
                  throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }

                const buffer = await response.arrayBuffer();
                const fileBuffer = Buffer.from(buffer);

                if (fileBuffer.length === 0) {
                  throw new Error('Downloaded file is empty');
                }

                console.log(`[Import] Downloaded: ${fileBuffer.length} bytes`);

                // Generate filename: use timestamp + random
                const timestamp = Date.now();
                const randomStr = Math.random().toString(36).substring(2, 8);
                const fileName = `question-${timestamp}-${randomStr}.jpg`;

                // Store file in SojebStorage
                await SojebStorage.put(appConfig().storageUrl.question + fileName, fileBuffer);
                fileUrl = fileName;
                console.log(`[Import] Stored question file: ${fileName}`);
              } catch (fileError) {
                console.warn(`[Import] Failed to download/store question file: ${fileError.message}`);
                // Continue without file
              }
            }

            // Create question
            const question = await this.prisma.question.create({
              data: {
                text: questionData.text,
                category_id: categoryId,
                language_id: languageId,
                difficulty_id: difficultyId,
                question_type_id: questionTypeId,
                file_url: fileUrl,
                time: questionData.time || 30,
                points: questionData.points || this.getDefaultPoints(questionData.difficulty),
                free_bundle: questionData.free_bundle || false,
                firebase: questionData.firebase || false,
              },
            });

            // Create answers directly from the answers array
            const answersData = questionData.answers.map(answer => ({
              text: answer.text,
              is_correct: answer.is_correct,
              question_id: question.id,
              file_url: answer.file_url || null,
            }));

            await this.prisma.answer.createMany({
              data: answersData,
            });

            return { success: true };
          } catch (questionError) {
            return {
              success: false,
              error: `Question ${questionIndex + 1}: ${questionError.message}`,
              text: questionData.text?.substring(0, 50)
            };
          }
        });

        // Wait for all questions in this batch to complete
        const batchResults = await Promise.allSettled(batchPromises);

        // Process batch results
        for (const result of batchResults) {
          if (result.status === 'fulfilled' && result.value.success) {
            successCount++;
          } else {
            errorCount++;
            if (result.status === 'fulfilled' && result.value.error) {
              errors.push(result.value.error);
            } else if (result.status === 'rejected') {
              errors.push(`Batch error: ${result.reason.message}`);
            }
          }
        }

        // Log progress
        console.log(`[Import] Batch complete: ${Math.min(batchEnd, questionsData.length)}/${questionsData.length} questions processed`);
      }

      return {
        success: true,
        message: `Import completed: ${successCount} questions imported successfully, ${errorCount} failed`,
        data: {
          total_processed: questionsData.length,
          successful: successCount,
          failed: errorCount,
          errors: errors,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: `Error importing questions: ${error.message}`,
      };
    }
  }

  // Helper method to get default points for difficulty
  private getDefaultPoints(difficulty: string): number {
    const difficultyPoints = {
      'Easy': 100,
      'Medium': 200,
      'Hard': 400,
    };
    return difficultyPoints[difficulty] || 100;
  }


  // Helper method to process answers based on question type
  private processAnswers(questionData: any): any[] {
    const answers = [];

    switch (questionData.question_type) {
      case 'Options':
        // For multiple choice questions
        if (questionData.options && questionData.options.length > 0) {
          questionData.options.forEach(option => {
            answers.push({
              text: option,
              is_correct: option === questionData.optionsAnswer,
              file_url: null,
            });
          });
        }
        break;

      case 'Text':
        // For text input questions
        if (questionData.textAnswer) {
          answers.push({
            text: questionData.textAnswer,
            is_correct: true,
            file_url: null,
          });
        }
        break;

      case 'Bools':
        // For true/false questions
        if (questionData.boolAnswer) {
          answers.push({
            text: questionData.boolAnswer,
            is_correct: true,
            file_url: null,
          });
          // Add the opposite option as incorrect
          const oppositeAnswer = questionData.boolAnswer === 'True' ? 'False' : 'True';
          answers.push({
            text: oppositeAnswer,
            is_correct: false,
            file_url: null,
          });
        }
        break;

      default:
        // Default case - try to use options if available
        if (questionData.options && questionData.options.length > 0) {
          questionData.options.forEach(option => {
            answers.push({
              text: option,
              is_correct: option === questionData.optionsAnswer,
              file_url: null,
            });
          });
        }
        break;
    }

    return answers;
  }


  // Export all questions
  async exportQuestions() {
    try {

      const questions = await this.prisma.question.findMany({
        select: {
          id: true,
          text: true,
          time: true,
          points: true,
          free_bundle: true,
          firebase: true,
          file_url: true,
          created_at: true,
          updated_at: true,
          category: {
            select: {
              id: true,
              name: true,
              image: true,
            },
          },
          language: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
          difficulty: {
            select: {
              id: true,
              name: true,
            },
          },
          question_type: {
            select: {
              id: true,
              name: true,
            },
          },
          answers: {
            select: {
              id: true,
              text: true,
              is_correct: true,
            },
          },
        },
        orderBy: {
          created_at: 'desc',
        },
      });

      for (const question of questions) {
        if (question.file_url) {
          question['question_file_url'] = SojebStorage.url(appConfig().storageUrl.question + question.file_url);
        }
      }

      for (const question of questions) {
        if (question.category.image) {
          question.category['image_url'] = SojebStorage.url(appConfig().storageUrl.category + question.category.image);
        }
      }

      // Format data for export
      const exportData = questions.map(question => ({
        text: question.text,
        category: question.category.name,
        language: question.language.name,
        difficulty: question.difficulty.name,
        question_type: question.question_type.name,
        time: question.time,
        points: question.points,
        free_bundle: question.free_bundle,
        question_file_url: question['question_file_url'],
        answers: question.answers.map(answer => ({
          text: answer.text,
          is_correct: answer.is_correct,
        })),
      }));

      return {
        success: true,
        message: `${questions.length} questions exported successfully`,
        data: exportData,
      };
    } catch (error) {
      return {
        success: false,
        message: `Error exporting questions: ${error.message}`,
      };
    }
  }
}
