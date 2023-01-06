import Api from "../../../tl/api";
import TelegramClient from "../../MockClient";

export default async function<A, R>(mockClient: TelegramClient, request: Api.Request<A, R>) {
    if(request instanceof Api.channels.GetForumTopics) {
        await new Promise((resolve) => setTimeout(resolve, 2500));
    }
    return "pass";
}
