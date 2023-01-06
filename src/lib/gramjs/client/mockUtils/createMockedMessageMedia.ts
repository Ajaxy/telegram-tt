import Api from "../../tl/api";
import {MockMessageMedia, MockTypes} from "./MockTypes";
import createMockedDocument from "./createMockedDocument";
import createMockedPhoto from "./createMockedPhoto";

export default function createMockedMessageMedia(media: MockMessageMedia, mockData: MockTypes): Api.TypeMessageMedia {
    if(media.type === "document") {
        return new Api.MessageMediaDocument({
            document: createMockedDocument(media.id, mockData)
        })
    }

    if(media.type === 'photo') {
        return new Api.MessageMediaPhoto({
            photo: createMockedPhoto(media.id, mockData)
        });
    }
    throw Error("Unsupported media: " + media.type)
}
