import Api from '../../tl/api';
import createMockedDocument from './createMockedDocument';
import type { MockAvailableReaction, MockTypes } from './MockTypes';

export default function createMockedAvailableReaction(
    mockAvailableReaction: MockAvailableReaction, mockData: MockTypes,
) {
    const {
        staticIconId,
        animationId,
        effectId,
        reaction,
        ...rest
    } = mockAvailableReaction;
    return new Api.AvailableReaction({
        ...rest,
        staticIcon: createMockedDocument(staticIconId, mockData),
        centerIcon: createMockedDocument(animationId, mockData),
        selectAnimation: createMockedDocument(animationId, mockData),
        aroundAnimation: createMockedDocument(effectId, mockData),
        reaction: reaction.emoticon,
        // Not used yet
        appearAnimation: createMockedDocument(animationId, mockData),
        activateAnimation: createMockedDocument(animationId, mockData),
        effectAnimation: createMockedDocument(animationId, mockData),
    });
}
