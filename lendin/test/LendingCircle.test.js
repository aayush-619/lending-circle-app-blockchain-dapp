const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("LendingCircle", function () {
  
  let lendingCircle;
  let token;
  let owner;
  let user1;
  let user2;

  beforeEach(async function () {
    // 1. Get test accounts
    [owner, user1, user2] = await ethers.getSigners();

    // 2. Deploy the MockStakeToken
    const Token = await ethers.getContractFactory("MockStakeToken");
    token = await Token.deploy();
    await token.waitForDeployment();
    const tokenAddress = await token.getAddress();

    // 3. Deploy the LendingCircle
    const LendingCircle = await ethers.getContractFactory("LendingCircle");
    lendingCircle = await LendingCircle.deploy(tokenAddress);
    await lendingCircle.waitForDeployment();
  });

  describe("addResource", function () {
    
    it("Should allow the owner to add a new resource", async function () {
      const stakeAmount = ethers.parseUnits("100", 18); // 100 tokens
      const duration = 7 * 24 * 60 * 60; // 7 days in seconds
      const penalty = ethers.parseUnits("5", 18); // 5 tokens per day
      const reward = ethers.parseUnits("1", 18); // 1 token
      
      await lendingCircle.connect(owner).addResource(
        "Distributed Systems Textbook",
        0, // Enum: PHYSICAL
        1,
        stakeAmount,
        duration,
        penalty,
        reward,
        "ipfs://bafybeic..."
      );

      const resourceId = 1; 
      const resource = await lendingCircle.resources(resourceId);

      expect(resource.id).to.equal(resourceId);
      expect(resource.name).to.equal("Distributed Systems Textbook");
      expect(resource.stakeAmount).to.equal(stakeAmount);
      expect(resource.active).to.be.true;
    });

    it("Should emit a ResourceAdded event", async function () {
      const stakeAmount = ethers.parseUnits("100", 18);
      const resourceId = 1;

      await expect(
        lendingCircle.connect(owner).addResource(
          "Book 2", 1, 5, stakeAmount, 86400, 0, 0, ""
        )
      ).to.emit(lendingCircle, "ResourceAdded")
       .withArgs(resourceId, "Book 2", stakeAmount, 5);
    });

    it("Should REVERT if a non-owner tries to add a resource", async function () {
      await expect(
        lendingCircle.connect(user1).addResource(
          "Failed Book",
          0, 1, 100, 86400, 0, 0, ""
        )
      ).to.be.revertedWith("Caller is not the owner");
    });

    it("Should REVERT if stake amount is zero", async function () {
      await expect(
        lendingCircle.connect(owner).addResource(
          "Free Book",
          1, 5, 0, 86400, 0, 0, ""
        )
      ).to.be.revertedWith("Stake must be greater than zero");
    });

    it("Should REVERT for a PHYSICAL item with maxBorrows != 1", async function () {
      await expect(
        lendingCircle.connect(owner).addResource(
          "Physical Book",
          0, // PHYSICAL
          5, // maxBorrows = 5 (invalid)
          100, 86400, 0, 0, ""
        )
      ).to.be.revertedWith("Physical items must have maxBorrows = 1");
    });
  });
  describe("returnResource", function () {
    const resourceId = 1;
    let stakeAmount, duration, penalty, reward;

    beforeEach(async function () {
      stakeAmount = ethers.parseUnits("100", 18);
      duration = 7 * 24 * 60 * 60; // 7 days
      penalty = ethers.parseUnits("10", 18); // 10 tokens/day
      reward = ethers.parseUnits("5", 18); // 5 token reward

      // 1. Add a resource
      await lendingCircle.connect(owner).addResource(
        "Test Book", 1, 5, stakeAmount, duration, penalty, reward, ""
      );

      // 2. Fund the reward pool as the owner
      const rewardPoolAmount = ethers.parseUnits("1000", 18);
      // Mint tokens to owner
      await token.connect(owner).mint(owner.address, rewardPoolAmount);
      // Owner approves contract
      await token.connect(owner).approve(lendingCircle.target, rewardPoolAmount);
      // Owner deposits into pool
      await lendingCircle.connect(owner).depositToRewardPool(rewardPoolAmount);

      // 3. user1 borrows the resource
      await token.connect(owner).mint(user1.address, stakeAmount);
      await token.connect(user1).approve(lendingCircle.target, stakeAmount);
      await lendingCircle.connect(user1).borrowResource(resourceId);
    });

    it("Should allow an ON-TIME return (with reward)", async function () {
      // Simulate time passing, but still within the duration (3 days)
      await time.increase(3 * 24 * 60 * 60);

      // Check balances before
      const userBalanceBefore = await token.balanceOf(user1.address);
      const poolBalanceBefore = await lendingCircle.rewardPool();
      expect(userBalanceBefore).to.equal(0);

      // User1 returns the resource
      await expect(
        lendingCircle.connect(user1).returnResource(resourceId)
      ).to.emit(lendingCircle, "ResourceReturned")
       .withArgs(resourceId, user1.address, stakeAmount + reward, 0);

      // Check balances after
      const userBalanceAfter = await token.balanceOf(user1.address);
      const poolBalanceAfter = await lendingCircle.rewardPool();
      const expectedRefund = stakeAmount + reward;
      expect(userBalanceAfter).to.equal(expectedRefund);
      expect(poolBalanceAfter).to.equal(poolBalanceBefore - reward);

      // Check state cleanup
      const borrowRecord = await lendingCircle.activeBorrows(user1.address, resourceId);
      expect(borrowRecord.isActive).to.be.false;
      const resource = await lendingCircle.resources(resourceId);
      expect(resource.currentBorrowerCount).to.equal(0);
    });

    it("Should process a LATE return (with penalty)", async function () {
      // Simulate time passing to 2 days late
      // 7 days duration + 2 days late = 9 days
      const lateDuration = 9 * 24 * 60 * 60;
      await time.increase(lateDuration);

      // Check balances before
      const userBalanceBefore = await token.balanceOf(user1.address);
      const poolBalanceBefore = await lendingCircle.rewardPool();

      // Calculate expected penalty
      // 3 days late @ 10 tokens/day = 30 tokens
      const expectedPenalty = penalty * 3n; // 3n is BigInt literal for 3
      const expectedRefund = stakeAmount - expectedPenalty;

      // User1 returns the resource
      await expect(
        lendingCircle.connect(user1).returnResource(resourceId)
      ).to.emit(lendingCircle, "ResourceReturned")
       .withArgs(resourceId, user1.address, expectedRefund, expectedPenalty);
      
      // Check balances after
      const userBalanceAfter = await token.balanceOf(user1.address);
      const poolBalanceAfter = await lendingCircle.rewardPool();
      
      expect(userBalanceAfter).to.equal(expectedRefund);
      // Penalty is added to the pool
      expect(poolBalanceAfter).to.equal(poolBalanceBefore + expectedPenalty);

      // Check state cleanup
      const borrowRecord = await lendingCircle.activeBorrows(user1.address, resourceId);
      expect(borrowRecord.isActive).to.be.false;
    });

    it("Should cap the penalty at the total stake amount", async function () {
      // Simulate being 20 days late
      // Penalty is 10/day, so 200 token penalty
      // Stake is only 100 tokens
      const veryLateDuration = 27 * 24 * 60 * 60; // 7 days + 20 days
      await time.increase(veryLateDuration);

      const poolBalanceBefore = await lendingCircle.rewardPool();

      // Expected penalty is capped at the stake amount (100)
      const expectedPenalty = stakeAmount;
      const expectedRefund = 0; // stake (100) - penalty (100) = 0

      // User1 returns
      await expect(
        lendingCircle.connect(user1).returnResource(resourceId)
      ).to.emit(lendingCircle, "ResourceReturned")
       .withArgs(resourceId, user1.address, expectedRefund, expectedPenalty);
      
      // Check balances
      const userBalanceAfter = await token.balanceOf(user1.address);
      const poolBalanceAfter = await lendingCircle.rewardPool();

      expect(userBalanceAfter).to.equal(0); // User gets nothing back
      // Pool only gains the 100 tokens from the stake
      expect(poolBalanceAfter).to.equal(poolBalanceBefore + stakeAmount);
    });

    it("Should REVERT if user is not borrowing the item", async function () {
      await expect(
        lendingCircle.connect(user2).returnResource(resourceId) // user2 tries to return
      ).to.be.revertedWith("You are not borrowing this item");

      // user1 returns successfully
      await lendingCircle.connect(user1).returnResource(resourceId);

      // user1 tries to return it AGAIN
      await expect(
        lendingCircle.connect(user1).returnResource(resourceId) 
      ).to.be.revertedWith("You are not borrowing this item");
    });
  });
});