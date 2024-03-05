import { getActions } from "../global"
import * as custom from "./custom"
import * as events from "./events"

export type { Methods } from "../api/gramjs/methods/types"
export type Actions = ReturnType<typeof getActions>
export type Custom = typeof custom
export type Events = typeof events
