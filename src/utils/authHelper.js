require("dotenv").config();
const { createSecretToken } = require("../tokenGeneration/generateToken");
const jwt = require("jsonwebtoken");
const { errorHandler } = require("../utils/responseHandler");

const createAuthResponse = (user, res) => {
  const token = createSecretToken(user.id, user.role);
  const refreshToken = jwt.sign(
    { _id: user._id, role: user.role },
    process.env.ACCESS_TOKEN_SECRET,
    {
      expiresIn: "7d",
    }
  );

  // Set tokens in cookies
  res.cookie("authToken", token, {
    httpOnly: true,
    maxAge: 25 * 24 * 60 * 60 * 1000, // 25 days in milliseconds
    secure: process.env.NODE_ENV === "production",
  });

  res.cookie("refreshToken", refreshToken, {
    httpOnly: true,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
    secure: process.env.NODE_ENV === "production",
  });

  res.setHeader("Authorization", `Bearer ${token}`);

  return {
    token,
    refreshToken,
    user: {
      _id: user.id,
      mobileNo: user.mobileNo,
      email: user.email,
      role: user.role,
    },
  };
};

const verifyToken = (req, res, next) => {
  const token =
    req?.cookies?.authToken || req?.headers?.authorization?.split(" ")[1];
  if (!token) {
    return errorHandler({
      res,
      statusCode: 400,
      message: "Unauthorized",
    });
  }

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return errorHandler({
        res,
        statusCode: 403,
        message: err?.message,
      });
    }
    req.user = decoded;
    next();
  });
};

module.exports = {
  createAuthResponse,
  verifyToken,
};
