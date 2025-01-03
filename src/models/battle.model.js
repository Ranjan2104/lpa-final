const { Schema, model } = require("mongoose");

const resultSchema = new Schema({
  acceptedUser: {
    matchStatus: {
      type: String,
      enum: ["WON", "LOSS", "CANCELLED"],
    },
    screenShot: {
      type: String,
    },
    cancellationReason: {
      type: String,
    },
    updatedAt: {
      type: Date,
      default: Date.now(),
    },
  },
  createdUser: {
    matchStatus: {
      type: String,
      enum: ["WON", "LOSS", "CANCELLED"],
    },
    screenShot: {
      type: String,
    },
    cancellationReason: {
      type: String,
    },
    updatedAt: {
      type: Date,
      default: Date.now(),
    },
  },
});

const battleSchema = new Schema(
  {
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    roomNo: {
      type: String,
      default: null,
    },
    status: {
      type: String,
      enum: ["OPEN", "PLAYING", "CLOSED"],
      default: "OPEN",
    },
    entryFee: {
      type: Number,
      required: true,
    },
    winnerAmount: {
      type: Number,
    },
    acceptedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    acceptedDate: {
      type: Date,
      default: null,
    },
    matchStatus: {
      type: String,
      enum: ["COMPLETED", "CANCELLED", "PENDING"],
      default: "PENDING",
    },
    isBattleRequestAccepted: {
      type: Boolean,
      default: false,
    },

    paymentStatus: {
      type: String,
      enum: ["PENDING", "COMPLETED"],
      default: "PENDING",
    },
    winner: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    loser: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    resultUpatedBy: resultSchema,
  },
  {
    timestamps: true,
  }
);


battleSchema.pre("save", function (next) {
  if (this.isModified("acceptedBy")) {
    if (this.acceptedBy) {
      this.acceptedDate = new Date(); // Set current date
    } else {
      this.acceptedDate = null; // Set to null
    }
  }
  next();
});

const Battle = model("battle", battleSchema);


module.exports = Battle;
