import { supabase } from './supabaseClient';

const BUCKET_NAME = 'receipts'; // Ensure this bucket exists in your Supabase Storage

export const uploadImageToSupabase = async (file: Blob, userId: string): Promise<string> => {
  const fileName = `${userId}/${Date.now()}-${Math.random().toString(36).substring(2, 9)}.jpeg`;
  
  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(fileName, file, {
      cacheControl: '3600',
      upsert: false,
      contentType: 'image/jpeg',
    });

  if (error) {
    console.error("Supabase Storage Upload Error:", error);
    throw new Error('Failed to upload image to storage.');
  }

  // Get public URL
  const { data: publicUrlData } = supabase.storage
    .from(BUCKET_NAME)
    .getPublicUrl(fileName);

  if (!publicUrlData || !publicUrlData.publicUrl) {
      throw new Error('Failed to get public URL for uploaded image.');
  }
  
  return publicUrlData.publicUrl;
};

export const deleteImageFromSupabase = async (imageUrl: string): Promise<void> => {
    // Extract file path from public URL
    // e.g., 'https://yourproject.supabase.co/storage/v1/object/public/receipts/user_id/filename.jpeg'
    const pathParts = imageUrl.split(BUCKET_NAME + '/');
    if (pathParts.length < 2) {
        console.warn("Invalid Supabase image URL, cannot delete:", imageUrl);
        return;
    }
    const filePath = pathParts[1];

    const { error } = await supabase.storage
        .from(BUCKET_NAME)
        .remove([filePath]);

    if (error) {
        console.error("Supabase Storage Delete Error:", error);
        throw new Error('Failed to delete image from storage.');
    }
};

// Helper to convert base64 to Blob
export const base64ToBlob = (base64: string, mimeType: string): Blob => {
    const byteString = atob(base64.split(',')[1]);
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    for (let i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i);
    }
    return new Blob([ab], { type: mimeType });
};
