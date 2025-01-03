const { Schema, model } = require("mongoose");

const bankAccountDetailsSchema = new Schema({
  bankName: {
    type: String,
    required: true,
  },
  accountNumber: {
    type: String,
    required: true,
  },
  ifscCode: {
    type: String,
    required: true,
  },
});

const userDetailsSchema = new Schema({
  name: {
    type: String,
    required: true,
  },
  mobileNo: {
    type: String,
    required: true,
  },
});

const transactionSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    userDetails: userDetailsSchema,
    type: {
      type: String,
      enum: ["deposit", "withdraw", "referral", "bonus", "penalty"],
      required: true,
    },
    isReferral: {
      type: Boolean,
      default: false,
    },
    amount: {
      type: Number,
      required: true,
    },
    paymentMethod: {
      type: String,
      enum: ["upi", "bankAccount"],
    },
    isBattleTransaction: {
      type: Boolean,
      default: false,
    },
    isWonCash: {
      type: Boolean,
      default: false,
    },
    upiId: {
      type: String,
    },
    battleId: {
      type: Schema.Types.ObjectId,
      ref: "Battle",
      default: null,
    },
    bankAccountDetails: bankAccountDetailsSchema,
    status: {
      type: "string",
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    utrNo: {
      type: String,
    },
    approvedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    screenShot: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

const Transaction = model("transaction", transactionSchema);

module.exports = Transaction;
