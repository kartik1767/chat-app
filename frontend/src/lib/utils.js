export function formatMessageTime(date) {
  return new Date(date).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

// Safe message for toasts: network errors have no `response`, and some APIs use `error` instead of `message`
export function getErrorMessage(error, fallback = "Something went wrong. Please try again.") {
  const data = error?.response?.data;
  return data?.message || data?.error || (error?.response ? fallback : "Can't reach the server. Check your connection.");
}

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

// Returns an error string, or null if the file is an acceptable image
export function validateImageFile(file) {
  if (!file.type.startsWith("image/")) return "Please select an image file";
  if (file.size > MAX_IMAGE_BYTES) return "Image must be 5 MB or smaller";
  return null;
}
