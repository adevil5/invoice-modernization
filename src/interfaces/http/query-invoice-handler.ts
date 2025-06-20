// Placeholder handler - to be implemented
export const handler = async (_event: unknown): Promise<{statusCode: number; body: string}> => {
  return {
    statusCode: 200,
    body: JSON.stringify({ message: 'Query invoice handler' })
  };
};