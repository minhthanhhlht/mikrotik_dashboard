import { haService } from '../lib/homeAssistant'

/**
 * Truy cập trực tiếp singleton HA service cho các thao tác action.
 * Vì haService là singleton duy nhất nên việc import trực tiếp là an toàn.
 */
export const homeAssistantService = haService
