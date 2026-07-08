import { Request, Response, NextFunction } from 'express';
import { StyleService } from './style.service';
import {
  OnboardingQuizSchema,
  RecordLearningEventSchema,
  UpdateStyleProfileSchema,
  PatchLearnedRuleSchema,
} from './style.types';
import { ApiResponse } from '../../shared/types/common.types';

const service = new StyleService();

export class StyleController {

  async createStyleProfile(req: Request, res: Response, next: NextFunction) {
    try {
      const input = OnboardingQuizSchema.parse(req.body);
      const result = await service.createStyleProfile(req.tenantContext!, input);
      res.status(201).json({ success: true, data: result } as ApiResponse);
    } catch (error) {
      next(error);
    }
  }

  async getStyleProfile(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await service.getStyleProfile(req.tenantContext!);
      res.json({ success: true, data: result } as ApiResponse);
    } catch (error) {
      next(error);
    }
  }

  /**
   * PUT /style — upsert from the frontend wizard.
   * Accepts frontend-friendly values (FORMAL, LOW, etc.) and maps to DB enums.
   * Also accepts vocabularyPhrases and avoidPhrases for Phase 1 setup.
   */
  async updateStyleProfile(req: Request, res: Response, next: NextFunction) {
    try {
      const body = UpdateStyleProfileSchema.parse(req.body);

      // Legacy frontend values kept for backward compatibility
      const toneMap: Record<string, string> = {
        FORMAL: 'PROFESSIONAL', CASUAL: 'PLAYFUL', FRIENDLY: 'FRIENDLY',
        PROFESSIONAL: 'PROFESSIONAL', PLAYFUL: 'PLAYFUL', PREMIUM: 'PREMIUM',
      };
      const emojiMap: Record<string, string> = {
        NONE: 'NONE', LOW: 'LIGHT', MODERATE: 'LIGHT',
        HIGH: 'FREQUENT', LIGHT: 'LIGHT', FREQUENT: 'FREQUENT',
      };

      // Absent or empty fields are omitted so the service leaves the stored
      // value untouched — a partial save never resets other columns.
      const result = await service.upsertStyleProfile(req.tenantContext!, {
        ...(body.tone && {
          tone: toneMap[body.tone] as 'FRIENDLY' | 'PROFESSIONAL' | 'PLAYFUL' | 'PREMIUM',
        }),
        ...(body.emojiUsage && {
          emojiUsage: emojiMap[body.emojiUsage] as 'NONE' | 'LIGHT' | 'FREQUENT',
        }),
        ...(body.formality !== undefined && { formality: body.formality }),
        ...(Array.isArray(body.signaturePhrases) && { signaturePhrases: body.signaturePhrases }),
        ...(body.targetAudience && { conversationGoal: body.targetAudience }),
        vocabularyPhrases: body.vocabularyPhrases,
        avoidPhrases:      body.avoidPhrases,
      });

      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async recordLearningEvent(req: Request, res: Response, next: NextFunction) {
    try {
      const input = RecordLearningEventSchema.parse(req.body);
      const result = await service.recordLearningEvent(req.tenantContext!, input);
      res.status(201).json({ success: true, data: result } as ApiResponse);
    } catch (error) {
      next(error);
    }
  }

  /** GET /style/learned-rules — list all derived rules for this tenant */
  async getLearnedRules(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await service.getLearnedRules(req.tenantContext!);
      res.json({ success: true, data: result } as ApiResponse);
    } catch (error) {
      next(error);
    }
  }

  /** PATCH /style/learned-rules/:id — activate or deactivate a rule */
  async patchLearnedRule(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const input = PatchLearnedRuleSchema.parse(req.body);
      const result = await service.patchLearnedRule(req.tenantContext!, id, input);
      res.json({ success: true, data: result } as ApiResponse);
    } catch (error) {
      next(error);
    }
  }
}
