import { deserializeModel, serializeModel } from './model-serialization';

describe('serializeModel/deserializeModel', () => {
  it('round-trips a plain object model', () => {
    const model = { type: 'mock-baseline', params: { average: 0.42 } };
    expect(deserializeModel(serializeModel(model))).toEqual(model);
  });

  it('round-trips an empty object', () => {
    expect(deserializeModel(serializeModel({}))).toEqual({});
  });

  it('produces a JSON string', () => {
    const model = { a: 1 };
    expect(serializeModel(model)).toBe('{"a":1}');
  });
});
