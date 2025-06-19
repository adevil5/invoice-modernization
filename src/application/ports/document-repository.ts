/**
 * Port interface for document storage.
 * Infrastructure adapters must implement this interface.
 */
export interface DocumentRepository {
  /**
   * Save a document to storage.
   * @param key - The storage key/path for the document
   * @param content - The document content as a buffer
   * @param contentType - MIME type of the document
   * @returns Promise that resolves when save is complete
   * @throws Error if save fails
   */
  save(key: string, content: Buffer, contentType: string): Promise<void>;

  /**
   * Get a document from storage.
   * @param key - The storage key/path for the document
   * @returns Buffer containing the document content
   * @throws Error if document not found or retrieval fails
   */
  get?(key: string): Promise<Buffer>;

  /**
   * Get a public URL for accessing a document.
   * @param key - The storage key/path for the document
   * @param expiresIn - Optional expiration time in seconds for the URL
   * @returns The URL to access the document
   * @throws Error if URL generation fails
   */
  getUrl(key: string, expiresIn?: number): Promise<string>;

  /**
   * Delete a document from storage.
   * @param key - The storage key/path for the document
   * @returns Promise that resolves when deletion is complete
   * @throws Error if deletion fails
   */
  delete?(key: string): Promise<void>;

  /**
   * Check if a document exists in storage.
   * @param key - The storage key/path for the document
   * @returns True if document exists, false otherwise
   */
  exists?(key: string): Promise<boolean>;
}