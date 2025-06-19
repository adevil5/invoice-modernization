process.env.NODE_ENV = 'test';
process.env.AWS_REGION = 'us-east-1';
process.env.DYNAMODB_TABLE_NAME = 'test-invoices';
process.env.S3_BUCKET_NAME = 'test-documents';
process.env.EVENTBRIDGE_BUS_NAME = 'test-bus';

global.beforeEach(() => {
  jest.clearAllMocks();
});

global.afterEach(() => {
  jest.restoreAllMocks();
});
