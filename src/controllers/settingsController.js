const Battle = require("../models/battle.model");
const Settings = require("../models/settings.model");
const Transaction = require("../models/transaction.model");
const User = require("../models/user.model");
const Notification = require("../models/notifications.model");
const getMessage = require("../utils/message");
const { errorHandler, successHandler } = require("../utils/responseHandler");

// update social media links
exports.updateSocialMediaLinks = async (req, res) => {
  try {
    const { role } = req.user;
    const { whatsAppLink, facebookLink, instagramLink, telegramLink } =
      req.body;

    if (role === "user") {
      return errorHandler({
        res,
        statusCode: 403,
        message: getMessage("M015"),
      });
    }

    const updateObject = {
      ...(whatsAppLink && { whatsAppLink }),
      ...(facebookLink && { facebookLink }),
      ...(instagramLink && { instagramLink }),
      ...(telegramLink && { telegramLink }),
    };

    if (Object.keys(updateObject).length === 0) {
      return errorHandler({
        res,
        statusCode: 400,
        message: getMessage("M026"),
      });
    }

    const updatedSettings = await Settings.updateOne(
      {},
      { $set: updateObject }
    );

    return successHandler({
      res,
      statusCode: 200,
      message: getMessage("M027"),
      data: updatedSettings,
    });
  } catch (err) {
    return errorHandler({
      res,
      statusCode: 500,
      message: err.message,
    });
  }
};

// update referral amount percentage
exports.updateReferralAmountPercentage = async (req, res) => {
  try {
    const { role } = req.user;
    const { referralAmountPercentage } = req.body;

    if (role === "user") {
      return errorHandler({
        res,
        statusCode: 403,
        message: getMessage("M015"),
      });
    }

    const updateObject = {
      ...(referralAmountPercentage && { referralAmountPercentage }),
    };

    const updatedSettings = await Settings.updateOne(
      {},
      { $set: updateObject }
    );

    return successHandler({
      res,
      statusCode: 200,
      message: getMessage("M028"),
      data: updatedSettings,
    });
  } catch (err) {
    return errorHandler({
      res,
      statusCode: 500,
      message: err.message,
    });
  }
};

// update payment setting
exports.updatePaymentSetting = async (req, res) => {
  try {
    const { role } = req.user;
    if (role === "user") {
      return errorHandler({
        res,
        statusCode: 403,
        message: getMessage("M015"),
      });
    }
    const { upiId, upiQrCode } = req.body;
    const updatedSettings = await Settings.updateOne(
      {},
      { $set: { upiId, upiQrCode } }
    );
    return successHandler({
      res,
      statusCode: 200,
      message: getMessage("M050"),
      data: updatedSettings,
    });
  } catch (err) {
    return errorHandler({
      res,
      statusCode: 500,
      message: err.message,
    });
  }
};

//approve kyc by admin
exports.approveKYC = async (req, res) => {
  try {
    const { _id, role } = req.user;
    if (role === "user") {
      return errorHandler({
        res,
        statusCode: 403,
        message: getMessage("M015"),
      });
    }
    const { userId } = req.params;
    const user = await User.findOne({ _id: userId });
    if (!user) {
      return errorHandler({
        res,
        statusCode: 400,
        message: getMessage("M002"),
      });
    }
    await User.findOneAndUpdate(
      { _id: userId },
      { isKYCVerified: true },
      { new: true }
    );
    return successHandler({
      res,
      statusCode: 200,
      message: getMessage("M049"),
    });
  } catch (err) {
    return errorHandler({
      res,
      statusCode: 500,
      message: err.message,
    });
  }
};

// get settings config
exports.getSettingsConfig = async (req, res) => {
  try {
    const data = await Settings.findOne({});
    return successHandler({
      res,
      statusCode: 200,
      data: data,
    });
  } catch (err) {
    return errorHandler({
      res,
      statusCode: 500,
      message: err.message,
    });
  }
};

exports.getUsersList = async (req, res) => {
  try {
    const { role } = req.user;
    if (role === "user") {
      return errorHandler({
        res,
        statusCode: 403,
        message: getMessage("M015"),
      });
    }
    const users = await User.find(
      { role: "user", isActive: true },
      { _id: 1, name: 1, mobileNo: 1 }
    );
    return successHandler({
      res,
      message: getMessage("M058"),
      statusCode: 200,
      data: users,
    });
  } catch (err) {
    return errorHandler({
      res,
      statusCode: 500,
      message: err.message,
    });
  }
};

exports.getUnverifiedUsersList = async (req, res) => {
  try {
    const { role } = req.user;
    if (role === "user") {
      return errorHandler({
        res,
        statusCode: 403,
        message: getMessage("M015"),
      });
    }

    const users = await User.find(
      { role: "user", isActive: true, isKYCVerified: false },
      { _id: 1, mobileNo: 1, kycDocument: 1 }
    );
    const usersList = users?.filter((user) => user?.kycDocument?.aadharNumber);
    return successHandler({
      res,
      message: getMessage("M059"),
      statusCode: 200,
      data: usersList,
    });
  } catch (err) {
    return errorHandler({
      res,
      statusCode: 500,
      message: err.message,
    });
  }
};

exports.adminDashboard = async (req, res) => {
  try {
    const { role } = req.user;
    if (role === "user") {
      return errorHandler({
        res,
        statusCode: 403,
        message: getMessage("M015"),
      });
    }
    const { fromDate, toDate } = req.query;
    const dateFilter =
      fromDate && toDate
        ? {
            createdAt: {
              $gte: new Date(fromDate).setHours(0, 0, 0, 0),
              $lte: new Date(toDate).setHours(23, 59, 59, 0),
            },
          }
        : {};

    const totalUsers = await User.countDocuments({
      role: "user",
      ...dateFilter,
    });
    const activeUsers = await User.countDocuments({
      role: "user",
      isActive: true,
      ...dateFilter,
    });
    const blockedUsers = await User.countDocuments({
      role: "user",
      isActive: false,
      ...dateFilter,
    });

    const totalAdmins = await User.countDocuments({
      role: "admin",
      ...dateFilter,
    });
    const activeAdmins = await User.countDocuments({
      role: "admin",
      isActive: true,
      ...dateFilter,
    });
    const blockedAdmins = await User.countDocuments({
      role: "admin",
      isActive: false,
      ...dateFilter,
    });

    const totalTransactions = await Transaction.countDocuments({
      isReferral: false,
      ...dateFilter,
    });
    const totalDeposits = await Transaction.countDocuments({
      type: "deposit",
      isReferral: false,
      ...dateFilter,
    });
    const totalWithdrawals = await Transaction.countDocuments({
      type: "withdraw",
      isReferral: false,
      ...dateFilter,
    });

    const totalBattle = await Battle.countDocuments({
      ...dateFilter,
    });
    const activeBattles = await Battle.countDocuments({
      status: "PLAYING",
      ...dateFilter,
    });

    const ongoingBattles = await Battle.countDocuments({
      status: "PLAYING",
      isBattleRequestAccepted: true,
      ...dateFilter,
    });

    const cancelledBattles = await Battle.countDocuments({
      CANCELLED: "CANCELLED",
      ...dateFilter,
    });

    const completedBattles = await Battle.countDocuments({
      status: "CLOSED",
      matchStatus: "COMPLETED",
      ...dateFilter,
    });

    const pendingDepositTransaction = await Transaction.countDocuments({
      status: "pending",
      type: "deposit",
      ...dateFilter,
    });

    const rejectedDepositRequest = await Transaction.countDocuments({
      status: "rejected",
      type: "deposit",
      ...dateFilter,
    });

    const pendingWithdrawalTransaction = await Transaction.countDocuments({
      status: "pending",
      type: "withdraw",
      ...dateFilter,
    });

    const rejectedWithdrawalRequest = await Transaction.countDocuments({
      status: "rejected",
      type: "withdraw",
      ...dateFilter,
    });

    const totalWithdraw = await Transaction.countDocuments({
      type: "withdraw",
      ...dateFilter,
    });

    const data = {
      totalUsers,
      activeUsers,
      blockedUsers,
      totalAdmins,
      activeAdmins,
      blockedAdmins,
      totalTransactions,
      totalDeposits,
      totalWithdrawals,
      totalBattle,
      activeBattles,
      ongoingBattles,
      cancelledBattles,
      pendingDepositTransaction,
      rejectedDepositRequest,
      pendingWithdrawalTransaction,
      rejectedWithdrawalRequest,
      completedBattles,
      totalWithdraw,
    };

    return successHandler({
      res,
      statusCode: 200,
      data,
      message: getMessage("M060"),
    });
  } catch (err) {
    return errorHandler({
      res,
      statusCode: 500,
      message: err.message,
    });
  }
};

exports.blockOrUnblockUsers = async (req, res) => {
  try {
    const { role } = req.user;
    if (role === "user") {
      return errorHandler({
        res,
        statusCode: 403,
        message: getMessage("M015"),
      });
    }
    const { userId, block } = req.body;
    const user = await User.findOne({ _id: userId });
    if (!user) {
      return errorHandler({
        res,
        statusCode: 400,
        message: getMessage("M002"),
      });
    }
    await User.findOneAndUpdate(
      { _id: userId },
      { isActive: !block },
      { new: true }
    );
    return successHandler({
      res,
      statusCode: 200,
      message: getMessage(block ? "M061" : "M064"),
    });
  } catch (err) {
    return errorHandler({
      res,
      statusCode: 500,
      message: err.message,
    });
  }
};

exports.penalty = async (req, res) => {
  try {
    const { role } = req.user;
    if (role === "user") {
      return errorHandler({
        res,
        statusCode: 403,
        message: getMessage("M015"),
      });
    }
    const { userId, amount, reason } = req.body;
    const user = await User.findOne({ _id: userId });
    if (!user) {
      return errorHandler({
        res,
        statusCode: 400,
        message: getMessage("M002"),
      });
    }
    if (user.balance.totalBalance < amount) {
      if (user.balance.cashWon < amount) {
        return errorHandler({
          res,
          statusCode: 400,
          message: getMessage("M043"),
        });
      }
      user.balance.cashWon -= amount;
    } else {
      user.balance.totalBalance -= amount;
    }
    user.balance.penalty += amount;
    user.save();

    await Transaction.create({
      type: "penalty",
      userId,
      amount: amount,
      status: "approved",
    });

    if (reason) {
      await Notification.create({
        userId,
        message: `You have been penalized for ${reason}`,
        title: "Penalty",
      });
    }

    return successHandler({
      res,
      statusCode: 200,
      message: getMessage("M062"),
    });
  } catch (err) {
    return errorHandler({
      res,
      statusCode: 500,
      message: err.message,
    });
  }
};

exports.getAllUsersList = async (req, res) => {
  try {
    const { role } = req.user;
    if (role === "user") {
      return errorHandler({
        res,
        statusCode: 403,
        message: getMessage("M015"),
      });
    }
    const users = await User.find(
      { role: "user" },
      { _id: 1, name: 1, mobileNo: 1, createdAt: 1, isActive: 1 }
    );
    return successHandler({
      res,
      message: getMessage("M058"),
      statusCode: 200,
      data: users,
    });
  } catch (err) {
    return errorHandler({
      res,
      statusCode: 500,
      message: err.message,
    });
  }
};

exports.addBonus = async (req, res) => {
  try {
    const { role } = req.user;
    if (role === "user") {
      return errorHandler({
        res,
        statusCode: 403,
        message: getMessage("M015"),
      });
    }
    const { userId, amount } = req.body;
    const user = await User.findOne({ _id: userId });
    if (!user) {
      return errorHandler({
        res,
        statusCode: 400,
        message: getMessage("M002"),
      });
    }

    user.balance.totalBalance += amount;
    user.save();

    await Transaction.create({
      type: "bonus",
      userId,
      amount,
      status: "approved",
    });

    await Notification.create({
      userId,
      message: `You have received ${amount} bonus`,
      title: "Bonus",
    });

    return successHandler({
      res,
      statusCode: 200,
      message: getMessage("M066"),
    });
  } catch (err) {
    return errorHandler({
      res,
      statusCode: 500,
      message: err.message,
    });
  }
};

exports.uploadKYCDocument = async (req, res) => {
  try {
    const { _id, role } = req.user;
    if (role === "user") {
      return errorHandler({
        res,
        statusCode: 403,
        message: getMessage("M015"),
      });
    }
    const { mobileNo, aadharNumber, name, frontPhoto, backPhoto } = req.body;

    // Update user KYC document data
    const updatedUser = await User.findOneAndUpdate(
      { mobileNo, isActive: true },
      {
        $set: {
          kycDocument: {
            aadharNumber,
            name,
            frontPhoto,
            backPhoto,
          },
          isKYCVerified: true,
        },
      },
      { new: true }
    );

    if (!updatedUser) {
      return errorHandler({
        res,
        statusCode: 400,
        message: "User not found or update failed",
      });
    }

    return successHandler({
      res,
      statusCode: 200,
      message: "KYC document uploaded successfully",
    });
  } catch (error) {
    return errorHandler({
      res,
      statusCode: 500,
      message: error.message,
    });
  }
};
