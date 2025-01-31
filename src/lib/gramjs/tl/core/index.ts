import GZIPPacked from './GZIPPacked';
import MessageContainer from './MessageContainer';
import RPCResult from './RPCResult';
import TLMessage from './TLMessage';

export const coreObjects = new Map<number, Function>([
    [RPCResult.CONSTRUCTOR_ID, RPCResult],
    [GZIPPacked.CONSTRUCTOR_ID, GZIPPacked],
    [MessageContainer.CONSTRUCTOR_ID, MessageContainer],
]);
export {
    RPCResult,
    TLMessage,
    MessageContainer,
    GZIPPacked,
};
