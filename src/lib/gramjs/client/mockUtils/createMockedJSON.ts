import Api from '../../tl/api';

export default function createMockedJSON(data: any): Api.TypeJSONValue {
    if (!data) {
        return new Api.JsonNull();
    }

    if (Array.isArray(data)) {
        return new Api.JsonArray({
            value: data.map(createMockedJSON),
        });
    }

    if (typeof data === 'string') {
        return new Api.JsonString({
            value: data,
        });
    }

    if (typeof data === 'number') {
        return new Api.JsonNumber({
            value: data,
        });
    }

    if (typeof data === 'boolean') {
        return new Api.JsonBool({
            value: data,
        });
    }

    return new Api.JsonObject({
        value: Object.entries(data).map(([key, value]) => (new Api.JsonObjectValue({
            key,
            value: createMockedJSON(value),
        }))),
    });
}
