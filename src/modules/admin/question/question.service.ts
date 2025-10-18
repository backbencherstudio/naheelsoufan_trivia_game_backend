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
        // Check if image is already a URL (starts with https)
        if (question.file_url.startsWith('https')) {
          question['question_file_url'] = question.file_url;
        } else {
          question['question_file_url'] = SojebStorage.url(appConfig().storageUrl.question + question.file_url);
        }
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
          // Check if image is already a URL (starts with https)
          if (question.file_url.startsWith('https')) {
            question['question_file_url'] = question.file_url;
          } else {
            question['question_file_url'] = SojebStorage.url(appConfig().storageUrl.question + question.file_url);
          }
        }
        if (question.answers && question.answers.length > 0) {
          for (const answer of question.answers) {
            if (answer.file_url) {
              // Check if image is already a URL (starts with https)
              if (answer.file_url.startsWith('https')) {
                answer['answer_file_url'] = answer.file_url;
              } else {
                answer['answer_file_url'] = SojebStorage.url(appConfig().storageUrl.answer + answer.file_url);
              }
            }
          }
        }
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
          // Check if image is already a URL (starts with https)
          if (question.file_url.startsWith('https')) {
            question['question_file_url'] = question.file_url;
          } else {
            question['question_file_url'] = SojebStorage.url(appConfig().storageUrl.question + question.file_url);
          }
        }

        // Loop through the answers to append the file URL
        if (question.answers && question.answers.length > 0) {
          for (const answer of question.answers) {
            if (answer.file_url) {
              // Check if image is already a URL (starts with https)
              if (answer.file_url.startsWith('https')) {
                answer['answer_file_url'] = answer.file_url;
              } else {
                answer['answer_file_url'] = SojebStorage.url(appConfig().storageUrl.answer + answer.file_url);
              }
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
        // Check if image is already a URL (starts with https)
        if (updatedQuestion.file_url.startsWith('https')) {
          updatedQuestion['question_file_url'] = updatedQuestion.file_url;
        } else {
          updatedQuestion['question_file_url'] = SojebStorage.url(appConfig().storageUrl.question + updatedQuestion.file_url);
        }
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

  // Import questions from uploaded file
  // async importQuestions(file: Express.Multer.File) {
  //   try {
  //     // Validate file type
  //     if (!file.mimetype.includes('json') && !file.originalname.endsWith('.json')) {
  //       throw new Error('Only JSON files are allowed for question import');
  //     }

  //     // Parse JSON content
  //     let questionsData;
  //     try {
  //       const fileContent = file.buffer.toString('utf8');
  //       questionsData = JSON.parse(fileContent);
  //     } catch (jsonError) {
  //       throw new Error('Invalid JSON file format');
  //     }

  //     // Validate JSON structure
  //     if (!Array.isArray(questionsData)) {
  //       throw new Error('JSON file must contain an array of questions');
  //     }

  //     let successCount = 0;
  //     let errorCount = 0;
  //     const errors = [];

  //     // Process each question
  //     for (let i = 0; i < questionsData.length; i++) {
  //       const questionData = questionsData[i];

  //       try {
  //         // Validate required fields
  //         if (!questionData.text || !questionData.category.id || !questionData.language.id ||
  //           !questionData.difficulty.id || !questionData.question_type.id || !questionData.answers) {
  //           throw new Error(`Missing required fields in question ${i + 1}`);
  //         }

  //         if (!Array.isArray(questionData.answers) || questionData.answers.length === 0) {
  //           throw new Error(`Question ${i + 1} must have at least one answer`);
  //         }

  //         // Check if at least one answer is correct
  //         const hasCorrectAnswer = questionData.answers.some(answer => answer.is_correct === true);
  //         if (!hasCorrectAnswer) {
  //           throw new Error(`Question ${i + 1} must have at least one correct answer`);
  //         }

  //         // Create question
  //         const question = await this.prisma.question.create({
  //           data: {
  //             text: questionData.text,
  //             category_id: questionData.category.id,
  //             language_id: questionData.language.id,
  //             difficulty_id: questionData.difficulty.id,
  //             question_type_id: questionData.question_type.id,
  //             file_url: questionData.file_url || null,
  //             time: questionData.time || 30,
  //             points: questionData.points || 10,
  //             free_bundle: questionData.free_bundle || false,
  //             firebase: questionData.firebase || false, // Should be boolean, not string
  //           },
  //         });

  //         // Create answers
  //         const answersData = questionData.answers.map(answer => ({
  //           text: answer.text,
  //           is_correct: answer.is_correct || false,
  //           question_id: question.id,
  //         }));

  //         await this.prisma.answer.createMany({
  //           data: answersData,
  //         });

  //         successCount++;
  //       } catch (questionError) {
  //         errorCount++;
  //         errors.push(`Question ${i + 1}: ${questionError.message}`);
  //       }
  //     }

  //     return {
  //       success: true,
  //       message: `Import completed: ${successCount} questions imported successfully, ${errorCount} failed`,
  //       data: {
  //         total_processed: questionsData.length,
  //         successful: successCount,
  //         failed: errorCount,
  //         errors: errors,
  //       },
  //     };
  //   } catch (error) {
  //     return {
  //       success: false,
  //       message: `Error importing questions: ${error.message}`,
  //     };
  //   }
  // }

  async importQuestions(file: Express.Multer.File) {
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
              file_url: questionData.file_url || null,
              time: questionData.time || 30,
              points: questionData.points || 10,
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

  // Helper method to get default points for difficulty
  private getDefaultPoints(difficulty: string): number {
    const difficultyPoints = {
      'Easy': 100,
      'Medium': 200,
      'Hard': 300,
      'Extreme': 500,
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
          // Check if image is already a URL (starts with https)
          if (question.file_url.startsWith('https')) {
            question['question_file_url'] = question.file_url;
          } else {
            question['question_file_url'] = SojebStorage.url(appConfig().storageUrl.question + question.file_url);
          }
        }
      }

      for (const question of questions) {
        if (question.category.image) {
          // Check if image is already a URL (starts with https)
          if (question.category.image.startsWith('https')) {
            question.category['image_url'] = question.category.image;
          } else {
            question.category['image_url'] = SojebStorage.url(appConfig().storageUrl.category + question.category.image);
          }
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
        firebase: question.firebase,
        file_url: question.file_url,
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
