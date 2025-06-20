// Placeholder handler - to be implemented
export const handler = (_event: unknown): Promise<{statusCode: number; body: string}> => {
  return Promise.resolve({
    statusCode: 200,
    body: JSON.stringify({ message: 'Query invoice handler' })
  });
};