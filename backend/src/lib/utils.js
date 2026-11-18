import jwt from "jsonwebtoken";

export const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:5173";

// ~5 MB image once decoded (base64 adds ~33%)
const MAX_IMAGE_DATA_URL_LENGTH = 7 * 1024 * 1024;

const cookieOptions = () => ({
  httpOnly: true, // prevent XSS attacks cross-site scripting attacks
  sameSite: "strict", // CSRF attacks cross-site request forgery attacks
  secure: process.env.NODE_ENV !== "development",
});

export const generateToken = (userId, res) => {
  const token = jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: "7d",
  });

  res.cookie("jwt", token, {
    ...cookieOptions(),
    maxAge: 7 * 24 * 60 * 60 * 1000, // MS
  });

  return token;
};

export const clearToken = (res) => {
  res.clearCookie("jwt", cookieOptions());
};

// Only accept base64 image data URLs, so Cloudinary is never asked to fetch arbitrary remote URLs
export const validateImageDataUrl = (image) => {
  if (typeof image !== "string" || !/^data:image\/(png|jpe?g|gif|webp);base64,/i.test(image)) {
    return "Image must be a PNG, JPEG, GIF or WebP file";
  }
  if (image.length > MAX_IMAGE_DATA_URL_LENGTH) {
    return "Image must be 5 MB or smaller";
  }
  return null;
};

export const normalizeEmail = (email) => (typeof email === "string" ? email.trim().toLowerCase() : "");

// Case-insensitive match so accounts created before emails were lowercased still work
export const EMAIL_COLLATION = { locale: "en", strength: 2 };
