const { ObjectId } = require("mongodb");
const Battle = require("../models/battle.model");
const getMessage = require("../utils/message");
const { errorHandler, successHandler } = require("../utils/responseHandler");
const User = require("../models/user.model");
const {
  updateTransactionForStartingGame,
  updateWinningAmountForWinner,
  isValidAmount,
} = require("../utils/battleHelper");
const Transaction = require("../models/transaction.model");

// create battle
exports.createBattle = async (req, res) => {
  try {
    const { _id, role } = req.user;
    const { amount } = req.body;
    if (Number(amount) < 50) {
      return errorHandler({
        res,
        statusCode: 400,
        message: getMessage("M056"),
      });
    }
    if (!isValidAmount(amount)) {
      return errorHandler({
        res,
        statusCode: 400,
        message: getMessage("M063"),
      });
    }

    if (!role === "user") {
      return errorHandler({
        res,
        statusCode: 400,
        message: getMessage("M015"),
      });
    }

    const checkPlayingBattle = await Battle.findOne({
      $or: [{ createdBy: _id }, { acceptedBy: _id }],
      status: "PLAYING",
    });
    if (checkPlayingBattle) {
      return errorHandler({
        res,
        statusCode: 400,
        message: getMessage("M036"),
      });
    }
    const checkOpenBattle = await Battle.find({
      createdBy: _id,
      status: "OPEN",
    });
    if (
      checkOpenBattle?.length >= 2 ||
      checkOpenBattle.some((item) => item?.entryFee == amount)
    ) {
      return errorHandler({
        res,
        statusCode: 400,
        message: getMessage("M055"),
      });
    }

    const userDetails = await User.findOne({ _id }, { balance: 1 });

    if (userDetails?.balance?.totalBalance < amount) {
      return errorHandler({
        res,
        statusCode: 400,
        message: getMessage("M043"),
      });
    }

    const winnerAmount = amount * 2 - amount * 0.2;
    await Battle.create({
      createdBy: _id,
      entryFee: amount,
      winnerAmount,
    });

    return successHandler({
      res,
      statusCode: 200,
      message: getMessage("M034"),
    });
  } catch (err) {
    return errorHandler({
      res,
      statusCode: 500,
      message: err.message,
    });
  }
};

exports.deleteBattle = async (req, res) => {
  try {
    const { _id, role } = req.user;
    if (!role === "user") {
      return errorHandler({
        res,
        statusCode: 400,
        message: getMessage("M015"),
      });
    }
    const { battleId } = req.params;
    const battleDetails = await Battle.findOne({ _id: battleId });

    if (battleDetails.acceptedBy || battleDetails.status !== "OPEN") {
      return errorHandler({
        res,
        statusCode: 400,
        message: getMessage("M015"),
      });
    }

    await Battle.deleteOne({ _id: battleId });

    return successHandler({
      res,
      statusCode: 200,
      message: getMessage("M044"),
    });
  } catch (err) {
    return errorHandler({
      res,
      statusCode: 500,
      message: err.message,
    });
  }
};
// battles list
exports.battlesListForAllUser = async (req, res) => {
  try {
    const { _id, role } = req.user;
    if (!role === "user")
      return errorHandler({
        res,
        statusCode: 400,
        message: getMessage("M015"),
      });

    const battles = await Battle.find(
      {
        $or: [{ status: "PLAYING" }, { status: "OPEN" }],
      },
      {
        entryFee: 1,
        winnerAmount: 1,
        roomNo: 1,
        acceptedBy: 1,
        createdBy: 1,
        status: 1,
        isBattleRequestAccepted: 1,
      }
    )
      .populate("acceptedBy createdBy", { _id: 1, name: 1 })
      .sort({ createdAt: -1 });

    const openBattles = battles
      .filter((battle) => battle.status === "OPEN")
      .map((battle) => {
        const battleObj = battle.toObject();

        const isCreatedByUser =
          battleObj.createdBy._id.toString() === _id.toString();
        const isAcceptedUser =
          battleObj?.acceptedBy?._id.toString() === _id.toString();

        const isAccepted = Boolean(battleObj?.acceptedBy?._id);

        // Determine the button state
        battleObj.showButton =
          !isAcceptedUser && !isCreatedByUser
            ? "play"
            : battleObj?.isBattleRequestAccepted
            ? isAccepted
              ? "start"
              : isCreatedByUser
              ? "redirect"
              : "waiting"
            : isCreatedByUser
            ? isAccepted
              ? "accept"
              : "delete"
            : isAccepted
            ? "waiting"
            : "play";

        return battleObj;
      });

    const liveBattles = battles.filter((battle) => battle.status === "PLAYING");

    return successHandler({
      res,
      statusCode: 200,
      message: getMessage("M035"),
      data: { openBattles, liveBattles },
    });
  } catch (err) {
    return errorHandler({
      res,
      statusCode: 500,
      message: err.message,
    });
  }
};

// send creater accept request
exports.sendCreaterAcceptRequest = async (req, res) => {
  try {
    const { _id, role } = req.user;
    if (!role === "user") {
      return errorHandler({
        res,
        statusCode: 400,
        message: getMessage("M015"),
      });
    }
    const { battleId } = req.params;
    const checkValidRequest = await Battle.findOne({
      _id: battleId,
      status: "OPEN",
      createdBy: { $ne: _id },
      acceptedBy: null,
    });

    if (!checkValidRequest) {
      return errorHandler({
        res,
        statusCode: 400,
        message: getMessage("M033"),
      });
    }
    const userDetails = await User.findOne({ _id }, { balance: 1 });

    const battleDetails = await Battle.findOne({
      _id: battleId,
      status: "OPEN",
      createdBy: { $ne: _id },
    });

    if (userDetails?.balance?.totalBalance < battleDetails.entryFee) {
      return errorHandler({
        res,
        statusCode: 400,
        message: getMessage("M043"),
      });
    }
    battleDetails.acceptedBy = _id;

    await battleDetails.save();
    return successHandler({
      res,
      statusCode: 200,
      message: getMessage("M035"),
    });
  } catch (err) {
    return errorHandler({
      res,
      statusCode: 500,
      message: err.message,
    });
  }
};

// accept or reject request By battle creater
exports.acceptOrRejectRequestByCreater = async (req, res) => {
  try {
    const { _id, role } = req.user;
    const { battleId, status } = req.body;

    // Validate role
    if (role !== "user") {
      return errorHandler({
        res,
        statusCode: 400,
        message: getMessage("M015"),
      });
    }

    // Fetch battle details
    const battleDetails = await Battle.findOne({ _id: battleId });
    if (!battleDetails) {
      return errorHandler({
        res,
        statusCode: 404,
        message: getMessage("M016"),
      });
    }

    if (
      battleDetails.status === "PLAYING" ||
      battleDetails.matchStatus === "COMPLETED"
    ) {
      return errorHandler({
        res,
        statusCode: 400,
        message: getMessage("M015"),
      });
    }

    const payload = {};
    let messageCode;

    if (status === "accept") {
      if (battleDetails.createdBy.toString() === _id.toString()) {
        payload.isBattleRequestAccepted = true;
        messageCode = "M038";

        await updateTransactionForStartingGame(
          _id,
          battleDetails.entryFee,
          battleDetails._id
        );
      } else {
        return errorHandler({
          res,
          statusCode: 403,
          message: getMessage("M017"),
        });
      }
    } else if (status === "reject") {
      messageCode = "M039";

      if (battleDetails.createdBy.toString() === _id.toString()) {
        payload.acceptedBy = null;
        payload.acceptedDate = null;
        payload.isBattleRequestAccepted = false;
      } else if (battleDetails.acceptedBy?.toString() === _id.toString()) {
        payload.resultUpatedBy = payload.resultUpatedBy || {};
        payload.resultUpatedBy.acceptedUser = {
          matchStatus: "CANCELLED",
          cancellationReason: "notJoined",
        };
        payload.status = "CLOSED";
      } else {
        return errorHandler({
          res,
          statusCode: 403,
          message: getMessage("M017"),
        });
      }
    } else {
      return errorHandler({
        res,
        statusCode: 400,
        message: getMessage("M018"),
      });
    }

    // Update battle details
    await Battle.findOneAndUpdate(
      { _id: battleId },
      { $set: payload },
      { new: true }
    );

    // Return success response
    return successHandler({
      res,
      statusCode: 200,
      message: getMessage(messageCode),
    });
  } catch (err) {
    return errorHandler({
      res,
      statusCode: 500,
      message: err.message,
    });
  }
};

//start game by accepted user
exports.startGameByAcceptedUser = async (req, res) => {
  try {
    const { _id, role } = req.user;

    if (!role === "user") {
      return errorHandler({
        res,
        statusCode: 400,
        message: getMessage("M015"),
      });
    }

    const battleDetails = await Battle.findOne({ _id: req.params.battleId });

    if (!battleDetails) {
      return errorHandler({
        res,
        statusCode: 400,
        message: getMessage("M015"),
      });
    }

    if (!battleDetails?.isBattleRequestAccepted) {
      return errorHandler({
        res,
        statusCode: 400,
        message: getMessage("M052"),
      });
    }

    await updateTransactionForStartingGame(
      _id,
      battleDetails?.entryFee,
      battleDetails._id
    );
    battleDetails.status = "PLAYING";
    await battleDetails.save();

    return successHandler({
      res,
      statusCode: 200,
      message: getMessage("M037"),
    });
  } catch (err) {
    return errorHandler({
      res,
      statusCode: 500,
      message: err.message,
    });
  }
};

// enter room number by battle creater
exports.enterRoomNumber = async (req, res) => {
  try {
    const { _id, role } = req.user;
    if (!role === "user") {
      return errorHandler({
        res,
        statusCode: 400,
        message: getMessage("M015"),
      });
    }
    const { roomNumber, battleId } = req.body;

    const checkCorrectUser = await Battle.findOne({
      createdBy: _id,
      _id: battleId,
    });
    if (!checkCorrectUser) {
      return errorHandler({
        res,
        statusCode: 400,
        message: getMessage("M015"),
      });
    }
    await Battle.findOneAndUpdate(
      { createdBy: _id, _id: battleId, status: "PLAYING" },
      { roomNo: roomNumber },
      { new: true }
    );
    return successHandler({
      res,
      statusCode: 200,
      message: getMessage("M037"),
    });
  } catch (err) {
    return errorHandler({
      res,
      statusCode: 500,
      message: err.message,
    });
  }
};

//battle details
exports.battleDetails = async (req, res) => {
  try {
    const { _id, role } = req.user;
    if (!role === "user") {
      return errorHandler({
        res,
        statusCode: 400,
        message: getMessage("M015"),
      });
    }
    const { battleId } = req.params;
    const battleDetails = await Battle.findOne({ _id: battleId }).populate(
      "createdBy acceptedBy",
      { _id: 1, name: 1 }
    );
    if (!battleDetails) {
      return errorHandler({
        res,
        statusCode: 400,
        message: getMessage("M041"),
      });
    }
    let isRoomNumberEntryAllowed =
      battleDetails?.createdBy?._id.toString() === _id.toString();
    return successHandler({
      res,
      statusCode: 200,
      message: getMessage("M040"),
      data: { ...battleDetails.toObject(), isRoomNumberEntryAllowed },
    });
  } catch (err) {
    return errorHandler({
      res,
      statusCode: 500,
      message: err.message,
    });
  }
};

// battle list for admin
exports.battleListAdmin = async (req, res) => {
  try {
    const { _id, role } = req.user;
    if (role === "user") {
      return errorHandler({
        res,
        statusCode: 400,
        message: getMessage("M015"),
      });
    }
    const { status } = req.query;
    const filter = {};
    if (status) filter.status = status;
    const battleList = await Battle.find(filter)
      .sort({ createdAt: -1 })
      .populate("createdBy acceptedBy winner loser", {
        _id: 1,
        name: 1,
        mobileNo: 1,
      });

    return successHandler({
      res,
      statusCode: 200,
      message: getMessage("M035"),
      data: battleList,
    });
  } catch (err) {
    return errorHandler({
      res,
      statusCode: 500,
      message: err.message,
    });
  }
};

//battle details for admin
exports.battleAdminDetails = async (req, res) => {
  try {
    const { _id, role } = req.user;
    if (role === "user") {
      return errorHandler({
        res,
        statusCode: 400,
        message: getMessage("M015"),
      });
    }
    const { battleId } = req.params;

    const battleDetails = await Battle.aggregate([
      {
        $match: {
          _id: new ObjectId(battleId),
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "createdBy",
          foreignField: "_id",
          pipeline: [
            {
              $project: {
                name: 1,
              },
            },
          ],
          as: "createdBy",
        },
      },
      {
        $unwind: {
          path: "$createdBy",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "acceptedBy",
          foreignField: "_id",
          pipeline: [
            {
              $project: {
                name: 1,
              },
            },
          ],
          as: "acceptedBy",
        },
      },
      {
        $unwind: {
          path: "$acceptedBy",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "winner",
          foreignField: "_id",
          pipeline: [
            {
              $project: {
                name: 1,
              },
            },
          ],
          as: "winner",
        },
      },
      {
        $unwind: {
          path: "$winner",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "loser",
          foreignField: "_id",
          pipeline: [
            {
              $project: {
                name: 1,
              },
            },
          ],
          as: "loser",
        },
      },
      {
        $unwind: {
          path: "$loser",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $lookup: {
          from: "transactions",
          localField: "createdBy._id",
          foreignField: "userId",
          pipeline: [
            {
              $match: {
                battleId: new ObjectId(battleId),
              },
            },
            {
              $project: {
                amount: 1,
                _id: 0,
              },
            },
          ],
          as: "createdHoldAmount",
        },
      },
      {
        $unwind: {
          path: "$createdHoldAmount",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $addFields: {
          createdHoldAmount: {
            $cond: {
              if: { $eq: ["$status", "CLOSED"] },
              then: 0,
              else: "$createdHoldAmount.amount",
            },
          },
        },
      },
      {
        $lookup: {
          from: "transactions",
          localField: "acceptedBy._id",
          foreignField: "userId",
          pipeline: [
            {
              $match: {
                battleId: new ObjectId(battleId),
              },
            },
            {
              $project: {
                amount: 1,
                _id: 0,
              },
            },
          ],
          as: "acceptedHoldAmount",
        },
      },
      {
        $unwind: {
          path: "$acceptedHoldAmount",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $addFields: {
          acceptedHoldAmount: {
            $cond: {
              if: { $eq: ["$status", "CLOSED"] },
              then: 0,
              else: "$acceptedHoldAmount.amount",
            },
          },
        },
      },
    ]);

    if (battleDetails.length === 0) {
      return errorHandler({
        res,
        statusCode: 400,
        message: getMessage("M041"),
      });
    }

    return successHandler({
      res,
      statusCode: 200,
      message: getMessage("M040"),
      data: battleDetails[0],
    });
  } catch (err) {
    return errorHandler({
      res,
      statusCode: 500,
      message: err.message,
    });
  }
};

// update final result
exports.updateBattleResultByUser = async (req, res) => {
  try {
    const { _id, role } = req.user;
    if (role !== "user") {
      return errorHandler({
        res,
        statusCode: 400,
        message: getMessage("M015"),
      });
    }

    const { battleId, matchStatus, screenShot, cancellationReason } = req.body;
    const battleDetails = await Battle.findById(battleId);

    if (!battleDetails) {
      return errorHandler({
        res,
        statusCode: 400,
        message: getMessage("M041"),
      });
    }
    if (battleDetails?.status !== "PLAYING") {
      return errorHandler({
        res,
        statusCode: 400,
        message: getMessage("M048"),
      });
    }
    const isAcceptedUser =
      battleDetails.acceptedBy.toString() === _id.toString();
    const isCreatedUser =
      battleDetails?.createdBy.toString() === _id.toString();

    if (!isAcceptedUser && !isCreatedUser) {
      return errorHandler({
        res,
        statusCode: 403,
        message: getMessage("M015"),
      });
    }

    const userKey = isAcceptedUser ? "acceptedUser" : "createdUser";

    const checkMatchStaus =
      battleDetails?.resultUpatedBy?.[userKey]?.matchStatus;

    if (checkMatchStaus) {
      return errorHandler({
        res,
        statusCode: 400,
        message: getMessage("M048"),
      });
    }

    if (!battleDetails.resultUpatedBy) {
      battleDetails.resultUpatedBy = {};
    }

    // Update match result for the user
    let updatedMatchResult = { matchStatus, screenShot };
    if (cancellationReason) {
      updatedMatchResult.cancellationReason = cancellationReason;
    }

    battleDetails.resultUpatedBy[userKey] = updatedMatchResult;

    await battleDetails.save();

    return successHandler({
      res,
      statusCode: 200,
      message: getMessage("M047"),
    });
  } catch (err) {
    return errorHandler({
      res,
      statusCode: 500,
      message: err.message,
    });
  }
};

// update final result by admin
exports.updateBattleResultByAdmin = async (req, res) => {
  try {
    const { _id, role } = req.user;
    if (role === "user") {
      return errorHandler({
        res,
        statusCode: 400,
        message: getMessage("M015"),
      });
    }

    const { battleId, winner, looser, isCancelled } = req.body;
    const battleDetails = await Battle.findById(battleId);

    if (!battleDetails) {
      return errorHandler({
        res,
        statusCode: 400,
        message: getMessage("M041"),
      });
    }

    if (
      isCancelled &&
      battleDetails?.resultUpatedBy?.acceptedUser?.matchStatus ===
        "CANCELLED" &&
      battleDetails?.resultUpatedBy?.acceptedBy?.cancellationReason ===
        "notJoined"
    ) {
      const transacion = await Transaction.deleteOne({
        battleId,
        userId: battleDetails?.createdBy,
      });
      if (transacion.deletedCount === 0) {
        return errorHandler({
          res,
          statusCode: 400,
          message: getMessage("M048"),
        });
      }
      const user = await User.findOne(
        { _id: battleDetails?.createdBy },
        { balance: 1 }
      );

      Object.assign(user.balance, {
        totalBalance: user.balance.totalBalance + battleDetails.entryFee,
        battlePlayed: user.balance.battlePlayed - 1,
      });

      await user.save();
    } else {
      if (battleDetails?.matchStatus !== "PENDING") {
        return errorHandler({
          res,
          statusCode: 400,
          message: getMessage("M048"),
        });
      }

      if (isCancelled) {
        if (
          battleDetails?.resultUpatedBy?.createdUser?.matchStatus !==
          "CANCELLED"
        ) {
          battleDetails.resultUpatedBy.createdUser.matchStatus = "CANCELLED";
          battleDetails.resultUpatedBy.createdUser.updatedAt = new Date();
        }
        if (
          battleDetails?.resultUpatedBy?.acceptedUser?.matchStatus !==
          "CANCELLED"
        ) {
          battleDetails.resultUpatedBy.acceptedUser.matchStatus = "CANCELLED";
          battleDetails.resultUpatedBy.acceptedUser.updatedAt = new Date();
        }
      } else {
        if (winner?.toString() === battleDetails?.createdBy?.toString()) {
          if (
            battleDetails?.resultUpatedBy?.createdUser?.matchStatus !== "WON"
          ) {
            battleDetails.resultUpatedBy.createdUser.matchStatus = "WON";
            battleDetails.resultUpatedBy.createdUser.updatedAt = new Date();
          }
          if (
            battleDetails?.resultUpatedBy?.acceptedUser?.matchStatus !== "LOSS"
          ) {
            battleDetails.resultUpatedBy.acceptedUser.matchStatus = "LOSS";
            battleDetails.resultUpatedBy.acceptedUser.updatedAt = new Date();
          }
        } else if (
          winner?.toString() === battleDetails?.acceptedBy?.toString()
        ) {
          if (
            battleDetails?.resultUpatedBy?.createdUser?.matchStatus !== "LOSS"
          ) {
            battleDetails.resultUpatedBy.createdUser.matchStatus = "LOSS";
          }
          if (
            battleDetails?.resultUpatedBy?.acceptedUser?.matchStatus !== "WON"
          ) {
            battleDetails.resultUpatedBy.acceptedUser.matchStatus = "WON";
          }
        }
      }

      await updateWinningAmountForWinner(battleDetails);

      // Update match details
      Object.assign(battleDetails, {
        matchStatus: isCancelled ? "CANCELLED" : "COMPLETED",
        winner,
        loser: looser,
        status: "CLOSED",
        paymentStatus: "COMPLETED",
      });
    }

    await battleDetails.save();

    return successHandler({
      res,
      statusCode: 200,
      message: getMessage("M047"),
    });
  } catch (err) {
    return errorHandler({
      res,
      statusCode: 500,
      message: err.message,
    });
  }
};

// battle list for user
exports.battleHistory = async (req, res) => {
  try {
    const { _id, role } = req.user;
    if (!role === "user") {
      return errorHandler({
        res,
        statusCode: 400,
        message: getMessage("M015"),
      });
    }
    const battleList = await Battle.find({
      $or: [{ acceptedBy: _id }, { createdBy: _id }],
    })
      .populate("acceptedBy createdBy winner loser", { _id: 1, name: 1 })
      .sort({ createdAt: -1 });
    const updatedBattleList = battleList.map((item) => ({
      ...item.toObject(),
      winStatus: item?.winner
        ? item?.winner?._id.toString() === _id.toString()
          ? "WIN"
          : "LOSE"
        : "PENDING",

      againstUser:
        _id.toString() === item?.createdBy?._id?.toString()
          ? item?.acceptedBy
          : item?.createdBy,
    }));
    return successHandler({
      res,
      statusCode: 200,
      message: getMessage("M035"),
      data: updatedBattleList,
    });
  } catch (err) {
    return errorHandler({
      res,
      statusCode: 500,
      message: err.message,
    });
  }
};
