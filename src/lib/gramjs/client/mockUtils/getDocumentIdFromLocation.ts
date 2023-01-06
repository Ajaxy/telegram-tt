import Api from "../../tl/api";

export default function getDocumentIdFromLocation(location: Api.TypeInputFileLocation): number {
    if(location instanceof Api.InputDocumentFileLocation) {
        return location.id.toJSNumber();
    }

    if(location instanceof Api.InputPhotoFileLocation){
        return location.id.toJSNumber();
    }

    throw Error("Unsupported input file location type " + location.className)
}
