import redisClient from '../../config/redis';
import logger from '../../config/logger';

/**
 * COST OPTIMIZATION: Cache prompt templates, not full prompts
 * 
 * Strategy:
 * - Cache static prompt skeletons (system instructions, formatting rules)
 * - Inject variable data (business info, signals, context) at runtime
 * - Benefit: 80%+ cache hit rate, predictable costs
 */
export class TemplateCache {
  private readonly CACHE_TTL = parseInt(process.env.PROMPT_CACHE_TTL || '3600');

  /**
   * Get or create system instruction template
   */
  async getSystemTemplate(
    tenantId: string,
    styleProfileId: string
  ): Promise<string | null> {
    const key = `template:system:${tenantId}:${styleProfileId}`;
    
    try {
      const cached = await redisClient.get(key);
      if (cached) {
        logger.debug('System template cache hit', { tenantId });
        return cached;
      }
    } catch (error) {
      logger.warn('Template cache read failed', { error });
    }

    return null;
  }

  /**
   * Store system instruction template
   */
  async setSystemTemplate(
    tenantId: string,
    styleProfileId: string,
    template: string
  ): Promise<void> {
    const key = `template:system:${tenantId}:${styleProfileId}`;
    
    try {
      await redisClient.setEx(key, this.CACHE_TTL, template);
      logger.debug('System template cached', { tenantId });
    } catch (error) {
      logger.warn('Template cache write failed', { error });
    }
  }

  /**
   * Clear cache when style profile is updated
   */
  async clearTenantCache(tenantId: string): Promise<void> {
    const pattern = `template:*:${tenantId}:*`;
    
    try {
      const keys = await redisClient.keys(pattern);
      if (keys.length > 0) {
        await redisClient.del(keys);
        logger.info('Tenant template cache cleared', { tenantId, count: keys.length });
      }
    } catch (error) {
      logger.warn('Template cache clear failed', { error });
    }
  }
}
