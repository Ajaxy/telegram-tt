import Api from "../../tl/api";
import BigInt from "big-integer";
import {MOCK_STARTING_DATE, MockTypes} from "./MockTypes";

export default function createMockedDocument(documentId: number, mockData: MockTypes): Api.Document {
    const document = mockData.documents.find(doc => doc.id === documentId);

    if(!document) throw Error("No such document " + documentId);

    const {
        accessHash = BigInt(1),
        fileReference = Buffer.from([0]),
        date = MOCK_STARTING_DATE,
        dcId = 2,
        url,
        ...rest
    } = document;

    return new Api.Document({
        ...rest,
        id: BigInt(documentId),
        accessHash,
        fileReference,
        date,
        // thumbs?: Api.TypePhotoSize[];
        // videoThumbs?: Api.TypeVideoSize[];
        dcId,
        attributes: [],//Api.TypeDocumentAttribute[];
    });
}
