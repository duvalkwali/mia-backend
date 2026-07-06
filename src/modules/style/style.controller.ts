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

      const toneMap: Record<string, string> = {
        FORMAL: 'PROFESSIONAL', CASUAL: 'PLAYFUL', FRIENDLY: 'FRIENDLY',
        PROFESSIONAL: 'PROFESSIONAL', PLAYFUL: 'PLAYFUL', PREMIUM: 'PREMIUM',
      };
      const emojiMap: Record<string, string> = {
        NONE: 'NONE', LOW: 'LIGHT', MODERATE: 'LIGHT',
        HIGH: 'FREQUENT', LIGHT: 'LIGHT', FREQUENT: 'FREQUENT',
      };

      const result = await service.upsertStyleProfile(req.tenantContext!, {
        tone:             (toneMap[body.tone] || 'FRIENDLY') as 'FRIENDLY' | 'PROFESSIONAL' | 'PLAYFUL' | 'PREMIUM',
        emojiUsage:       (emojiMap[body.emojiUsage] || 'NONE') as 'NONE' | 'LIGHT' | 'FREQUENT',
        formality:        Number(body.formality) || 3,
        signaturePhrases: Array.isArray(body.signaturePhrases) ? body.signaturePhrases : [],
        conversationGoal: body.targetAudience || 'build_rapport',
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
