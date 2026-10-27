import type { components } from './fapi-schema';
export type BotCheckHint = components['schemas']['ClientBotCheck'];
export interface BotCheckProvider {
    token(hint: BotCheckHint): Promise<string>;
}
//# sourceMappingURL=botCheck.d.ts.map