// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// We import the standard interface for an ERC-20 token.
// Our contract will interact with ANY token that follows this standard.
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract LendingCircle {
    
    // --- State Variables ---

    // The ERC-20 token contract we will use for staking
    // 'immutable' means it can only be set once in the constructor.
    IERC20 public immutable stakeToken;

    // The address that can add resources, withdraw penalties, etc.
    address public owner;

    // A pool to hold collected penalties, which can then fund rewards
    uint256 public rewardPool;

    // Counter to create unique IDs for new resources
    uint256 private _resourceIdCounter;

    // --- Structs & Enums ---

    // Define the two types of resources
    enum ResourceType { PHYSICAL, DIGITAL }

    // This struct defines a lendable resource
    struct Resource {
        uint256 id;
        string name;
        ResourceType resourceType;
        uint256 maxConcurrentBorrows; // 1 for PHYSICAL, N for DIGITAL
        uint256 currentBorrowerCount;
        uint256 stakeAmount;         // The "deposit" required in stakeToken
        uint256 borrowDuration;      // Max borrow time in seconds (e.g., 604800 for 7 days)
        uint256 latePenaltyPerDay;   // Penalty deducted from stake for each day overdue
        uint256 onTimeReward;        // Small reward for returning on time
        string metadataURI;          // Link to IPFS for image/description/file link
        bool active;                 // To allow "delisting"
    }

    // This struct tracks an active borrow
    struct BorrowRecord {
        address borrower;
        uint256 resourceId;
        uint256 borrowTime;        // block.timestamp when borrowed
        uint256 stakeDeposited;
        bool isActive;
    }

    // --- Mappings (The "Database") ---

    // Maps a resourceId to its Resource struct
    mapping(uint256 => Resource) public resources;

    // Maps a user's address to their active borrow record for a specific resource
    // A user can borrow multiple different resources simultaneously
    // mapping(address => mapping(uint256 => BorrowRecord))
    mapping(address => mapping(uint256 => BorrowRecord)) public activeBorrows;

    // --- Modifiers ---

    modifier onlyOwner() {
        require(msg.sender == owner, "Caller is not the owner");
        _;
    }

    // --- Events ---

    event ResourceAdded(
        uint256 indexed resourceId, 
        string name, 
        uint256 stakeAmount, 
        uint256 maxConcurrentBorrows
    );
    event ResourceBorrowed(
        uint256 indexed resourceId, 
        address indexed borrower, 
        uint256 stakeAmount, 
        uint256 deadline
    );
    event ResourceReturned(
        uint256 indexed resourceId, 
        address indexed borrower, 
        uint256 refundAmount, 
        uint256 penaltyPaid
    );

    // --- Functions ---

    /**
     * @dev Sets the address of the ERC-20 token to be used for staking.
     */
    constructor(address _tokenAddress) {
        stakeToken = IERC20(_tokenAddress);
        owner = msg.sender;
        _resourceIdCounter = 1; // Start counter at 1
    }

    /**
     * @dev Adds a new resource to the lending pool. Only callable by the owner.
     * @param _name Name of the resource (e.g., "Distributed Systems Textbook")
     * @param _type PHYSICAL (0) or DIGITAL (1)
     * @param _maxBorrows Max concurrent users (1 for PHYSICAL)
     * @param _stake Amount of stakeToken required to borrow
     * @param _duration The borrow duration in seconds
     * @param _penalty Penalty per day (in seconds) overdue
     * @param _reward Reward for returning on time
     * @param _metadataURI IPFS hash or URL for resource details
     */
    function addResource(
        string memory _name,
        ResourceType _type,
        uint256 _maxBorrows,
        uint256 _stake,
        uint256 _duration,
        uint256 _penalty,
        uint256 _reward,
        string memory _metadataURI
    ) public onlyOwner {
        // Validation
        require(bytes(_name).length > 0, "Name cannot be empty");
        require(_stake > 0, "Stake must be greater than zero");
        require(_duration > 0, "Duration must be greater than zero");
        
        if (_type == ResourceType.PHYSICAL) {
            require(_maxBorrows == 1, "Physical items must have maxBorrows = 1");
        } else {
            require(_maxBorrows > 0, "Digital items must allow at least 1 borrow");
        }

        // Get new ID
        uint256 newId = _resourceIdCounter;

        // Create and save the new resource
        resources[newId] = Resource({
            id: newId,
            name: _name,
            resourceType: _type,
            maxConcurrentBorrows: _maxBorrows,
            currentBorrowerCount: 0,
            stakeAmount: _stake,
            borrowDuration: _duration,
            latePenaltyPerDay: _penalty,
            onTimeReward: _reward,
            metadataURI: _metadataURI,
            active: true
        });




        // Increment the counter for the next resource
        _resourceIdCounter++;

        // Emit an event to log this on the blockchain
        emit ResourceAdded(newId, _name, _stake, _maxBorrows);
    }

    /**
     * @dev Allows a user to borrow an active and available resource.
     * User must have first approved the contract to spend their stakeToken.
     */
    function borrowResource(uint256 _resourceId) public {
        // 1. --- Checks ---
        
        // Get the resource from storage
        Resource storage resource = resources[_resourceId];

        // Check if the resource is active/listed
        require(resource.active, "Resource is not available");
        
        // Check if the resource is at full borrowing capacity
        require(
            resource.currentBorrowerCount < resource.maxConcurrentBorrows,
            "Resource at max capacity"
        );
        
        // Check if this user is already borrowing this specific item
        require(
            !activeBorrows[msg.sender][_resourceId].isActive,
            "You are already borrowing this"
        );

        // 2. --- Staking ---
        uint256 stake = resource.stakeAmount;

        // This is the crucial step. The user must have already called
        // token.approve(this_contract_address, stake)
        // This 'transferFrom' pulls the stake from the user's wallet
        // and holds it in this contract.
        bool success = stakeToken.transferFrom(msg.sender, address(this), stake);
        require(success, "Token transfer failed. (Did you approve?)");

        // 3. --- Update State ---
        
        // Increment the number of current borrowers for this resource
        resource.currentBorrowerCount++;

        // Create a new borrow record for the user
        activeBorrows[msg.sender][_resourceId] = BorrowRecord({
            borrower: msg.sender,
            resourceId: _resourceId,
            borrowTime: block.timestamp,
            stakeDeposited: stake,
            isActive: true
        });

        // 4. --- Emit Event ---
        uint256 deadline = block.timestamp + resource.borrowDuration;
        emit ResourceBorrowed(_resourceId, msg.sender, stake, deadline);
    }

    function getAvailableResources() public view returns (uint256[] memory) {
        uint256 availableCount = 0;
        for (uint256 i = 1; i < _resourceIdCounter; i++) {
            if (resources[i].active && resources[i].currentBorrowerCount < resources[i].maxConcurrentBorrows) {
                availableCount++;
            }
        }

        uint256[] memory availableResources = new uint256[](availableCount);
        uint256 counter = 0;
        for (uint256 i = 1; i < _resourceIdCounter; i++) {
            if (resources[i].active && resources[i].currentBorrowerCount < resources[i].maxConcurrentBorrows) {
                availableResources[counter] = i;
                counter++;
            }
        }

        return availableResources;
    }

    function getMyBorrowedResources() public view returns (uint256[] memory) {
        uint256 borrowedCount = 0;
        for (uint256 i = 1; i < _resourceIdCounter; i++) {
            if (activeBorrows[msg.sender][i].isActive) {
                borrowedCount++;
            }
        }

        uint256[] memory borrowedResources = new uint256[](borrowedCount);
        uint256 counter = 0;
        for (uint256 i = 1; i < _resourceIdCounter; i++) {
            if (activeBorrows[msg.sender][i].isActive) {
                borrowedResources[counter] = i;
                counter++;
            }
        }

        return borrowedResources;
    }

    function getResourceDetails(uint256 _resourceId) public view returns (Resource memory) {
        return resources[_resourceId];
    }
    
    /**
     * @dev Internal function to calculate refund and penalty.
     * This makes the logic testable and reusable.
     */
    function _calculateRefund(
        BorrowRecord memory _borrow,
        Resource memory _resource
    )
        private
        view
        returns (uint256 refundAmount, uint256 penalty)
    {
        uint256 timeElapsed = block.timestamp - _borrow.borrowTime;
        uint256 stake = _borrow.stakeDeposited;

        if (timeElapsed <= _resource.borrowDuration) {
            // --- On-Time Return ---
            uint256 reward = _resource.onTimeReward;

            // Check if reward pool can cover the reward
            if (rewardPool >= reward) {
                // Full stake + reward
                refundAmount = stake + reward;
            } else {
                // Reward pool is empty, just return the stake
                refundAmount = stake;
            }
            penalty = 0;
            
        } else {
            // --- Late Return ---
            uint256 overdueTime = timeElapsed - _resource.borrowDuration;
            
            // Calculate number of full days overdue.
            uint256 daysOverdue = ((overdueTime - 1) / 1 days) + 1;
            
            penalty = daysOverdue * _resource.latePenaltyPerDay;

            // Cap the penalty at the stake amount.
            // The user can't lose more than they staked.
            if (penalty > stake) {
                penalty = stake;
            }

            refundAmount = stake - penalty;
        }
    }

    /**
     * @dev Allows a user to return a borrowed resource.
     * Calculates and pays out rewards or penalties.
     */
    function returnResource(uint256 _resourceId) public {
        // 1. --- Checks ---
        BorrowRecord storage borrowRecord = activeBorrows[msg.sender][_resourceId];
        
        // Check if the user is actively borrowing this item
        require(borrowRecord.isActive, "You are not borrowing this item");

        // 2. --- Calculations ---
        // Get a copy of the resource in memory for calculations
        Resource memory resource = resources[_resourceId];
        
        (uint256 refundAmount, uint256 penalty) = _calculateRefund(
            borrowRecord,
            resource
        );

        // 3. --- Penalty/Reward Logic & State Update ---
        if (penalty > 0) {
            // Late Return: Add penalty to the reward pool
            rewardPool += penalty;
        } else {
            // On-Time Return: Deduct reward from the pool
            // We calculate the reward *again* to be explicit
            uint256 reward = resource.onTimeReward;
            if (rewardPool >= reward) {
                rewardPool -= reward;
            }
            // If rewardPool < reward, refundAmount was already
            // capped in _calculateRefund, so rewardPool is safe.
        }

        // 4. --- Cleanup State ---
        // We clean up the state *before* sending tokens
        // This is a best practice (Checks-Effects-Interactions pattern)
        borrowRecord.isActive = false;
        // Get the resource from *storage* to modify it
        resources[_resourceId].currentBorrowerCount--;

        // 5. --- Send Funds ---
        if (refundAmount > 0) {
            bool success = stakeToken.transfer(msg.sender, refundAmount);
            require(success, "Refund transfer failed");
        }

        // 6. --- Emit Event ---
        emit ResourceReturned(
            _resourceId,
            msg.sender,
            refundAmount,
            penalty
        );
    }

    /**
     * @dev Allows owner to deposit tokens into the reward pool
     */
    function depositToRewardPool(uint256 _amount) public onlyOwner {
        require(_amount > 0, "Amount must be greater than 0");
        bool success = stakeToken.transferFrom(msg.sender, address(this), _amount);
        require(success, "Token transfer failed");
        rewardPool += _amount;
    }

    /**
     * @dev Allows owner to withdraw tokens from the reward pool
     */
    function withdrawFromRewardPool(uint256 _amount) public onlyOwner {
        require(_amount <= rewardPool, "Insufficient funds in reward pool");
        rewardPool -= _amount;
        bool success = stakeToken.transfer(owner, _amount);
        require(success, "Token transfer failed");
    }
}