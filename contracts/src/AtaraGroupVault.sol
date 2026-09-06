// SPDX-License-Identifier: MIT
pragma solidity 0.8.36;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @notice Sepolia beta: fixed members, fixed lock date, unanimous withdrawals.
/// @dev No admin, upgrades, arbitrary calls, yield or unilateral refund path.
/// Smart accounts participate by calling directly; their owner EOA gets no vote.
contract AtaraGroupVault is ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint256 public constant PROPOSAL_LIFETIME = 7 days;
    IERC20 public immutable token;
    string public name;
    uint64 public immutable unlockAt;
    uint256 public immutable maxTotalDeposits;
    uint256 public totalDeposited;
    uint256 public acceptedCount;
    uint256 public proposalId;
    uint256 public cancellationApprovalCount;
    bool public cancelled;
    address[] private members;
    mapping(address => bool) public isMember;
    mapping(address => bool) public accepted;
    mapping(address => uint256) public contributions;
    mapping(address => mapping(bytes32 => bool)) public usedDepositIds;
    mapping(uint256 => mapping(address => bool)) public approved;
    mapping(address => bool) public cancellationApproved;

    struct Proposal {
        address recipient;
        uint256 amount;
        uint64 expiresAt;
        uint16 approvalCount;
        bool executed;
        bool cancelled;
    }
    Proposal public proposal;

    struct Snapshot {
        string name;
        uint64 unlockAt;
        uint256 chainTimestamp;
        uint256 balance;
        uint256 totalDeposited;
        uint256 maxTotalDeposits;
        uint256 acceptedCount;
        uint256 proposalId;
        uint256 cancellationApprovalCount;
        bool cancelled;
        address[] members;
        bool[] accepted;
        uint256[] contributions;
        bool[] approvals;
        bool[] cancellationApprovals;
        Proposal proposal;
    }

    error NotMember();
    error InvalidTerms();
    error FundingClosed();
    error MissingAcceptance();
    error AlreadyAccepted();
    error InvalidAmount();
    error Locked();
    error InvalidProposal();
    error ActiveProposal();
    error DuplicateApproval();
    error UnanimityRequired();
    error UnsupportedToken();
    error DuplicateDeposit();

    event TermsAccepted(address indexed member);
    event Deposited(address indexed member, bytes32 indexed depositId, uint256 amount);
    event WithdrawalProposed(uint256 indexed id, address indexed recipient, uint256 amount, uint64 expiresAt);
    event ApprovalChanged(uint256 indexed id, address indexed member, bool approved);
    event ProposalCancelled(uint256 indexed id);
    event Withdrawn(uint256 indexed id, address indexed recipient, uint256 amount);
    event CancellationApprovalChanged(address indexed member, bool approved);
    event VaultCancelled(uint256 totalRefunded);

    modifier onlyMember() {
        if (!isMember[msg.sender]) revert NotMember();
        _;
    }

    constructor(IERC20 token_, string memory name_, address[] memory members_, uint64 unlockAt_, uint256 cap_) {
        if (block.chainid != 84532 || address(token_).code.length == 0 || cap_ == 0 ||
            bytes(name_).length == 0 || bytes(name_).length > 64 ||
            members_.length < 2 || members_.length > 10 ||
            unlockAt_ < block.timestamp + 5 minutes || unlockAt_ > block.timestamp + 365 days) {
            revert InvalidTerms();
        }
        token = token_;
        name = name_;
        unlockAt = unlockAt_;
        maxTotalDeposits = cap_;
        for (uint256 i; i < members_.length; ++i) {
            address member = members_[i];
            if (member == address(0) || member == address(this) || isMember[member]) revert InvalidTerms();
            isMember[member] = true;
            members.push(member);
        }
    }

    function acceptTerms() external onlyMember {
        if (cancelled) revert FundingClosed();
        if (block.timestamp >= unlockAt) revert FundingClosed();
        if (accepted[msg.sender]) revert AlreadyAccepted();
        accepted[msg.sender] = true;
        ++acceptedCount;
        emit TermsAccepted(msg.sender);
    }

    function deposit(uint256 amount, bytes32 depositId) external onlyMember nonReentrant {
        if (cancelled) revert FundingClosed();
        if (usedDepositIds[msg.sender][depositId]) revert DuplicateDeposit();
        if (block.timestamp >= unlockAt) revert FundingClosed();
        if (acceptedCount != members.length) revert MissingAcceptance();
        if (amount == 0 || amount > maxTotalDeposits - totalDeposited) revert InvalidAmount();
        uint256 beforeBalance = token.balanceOf(address(this));
        usedDepositIds[msg.sender][depositId] = true;
        totalDeposited += amount;
        contributions[msg.sender] += amount;
        token.safeTransferFrom(msg.sender, address(this), amount);
        // A fee-on-transfer/rebasing token cannot silently corrupt accounting.
        if (token.balanceOf(address(this)) != beforeBalance + amount) revert UnsupportedToken();
        emit Deposited(msg.sender, depositId, amount);
    }

    function proposeWithdrawal(address recipient, uint256 amount, uint256 nextId) external onlyMember {
        if (cancelled) revert InvalidProposal();
        // A retry after a lost RPC response must never open another proposal.
        if (nextId != proposalId + 1) revert InvalidProposal();
        if (block.timestamp < unlockAt) revert Locked();
        if (acceptedCount != members.length) revert MissingAcceptance();
        if (recipient == address(0) || recipient == address(this) || recipient == address(token)) revert InvalidTerms();
        if (amount == 0 || amount > token.balanceOf(address(this))) revert InvalidAmount();
        if (proposalId != 0 && !proposal.executed && !proposal.cancelled && block.timestamp < proposal.expiresAt) {
            revert ActiveProposal();
        }
        ++proposalId;
        proposal = Proposal(recipient, amount, uint64(block.timestamp + PROPOSAL_LIFETIME), 0, false, false);
        // Proposing is deliberately not an approval, including for the creator.
        emit WithdrawalProposed(proposalId, recipient, amount, proposal.expiresAt);
    }

    function setApproval(uint256 id, bool approve) external onlyMember {
        if (cancelled) revert InvalidProposal();
        _checkProposal(id);
        if (approved[id][msg.sender] == approve) revert DuplicateApproval();
        approved[id][msg.sender] = approve;
        if (approve) ++proposal.approvalCount;
        else --proposal.approvalCount;
        emit ApprovalChanged(id, msg.sender, approve);
    }

    function cancelProposal(uint256 id) external onlyMember {
        if (cancelled) revert InvalidProposal();
        _checkProposal(id);
        proposal.cancelled = true;
        emit ProposalCancelled(id);
    }

    /// @notice Any member may execute the already unanimous, unchanged proposal.
    function executeWithdrawal(uint256 id) external onlyMember nonReentrant {
        if (cancelled) revert InvalidProposal();
        if (block.timestamp < unlockAt) revert Locked();
        _checkProposal(id);
        if (proposal.approvalCount != members.length) revert UnanimityRequired();
        proposal.executed = true;
        token.safeTransfer(proposal.recipient, proposal.amount);
        emit Withdrawn(id, proposal.recipient, proposal.amount);
    }

    /// @notice Members can unanimously dissolve the Vault and receive exactly
    /// their own recorded contribution back. No creator or ATARA administrator
    /// can unilaterally move funds.
    function setCancellationApproval(bool approve) external onlyMember {
        if (cancelled) revert InvalidProposal();
        if (cancellationApproved[msg.sender] == approve) revert DuplicateApproval();
        cancellationApproved[msg.sender] = approve;
        if (approve) ++cancellationApprovalCount;
        else --cancellationApprovalCount;
        emit CancellationApprovalChanged(msg.sender, approve);
    }

    /// @notice Any member may execute a unanimous cancellation. Each member is
    /// paid their own contribution, so no share is redistributed or lost.
    function cancelVault() external onlyMember nonReentrant {
        if (cancelled) revert InvalidProposal();
        if (proposalId != 0 && !proposal.executed && !proposal.cancelled && block.timestamp < proposal.expiresAt) {
            revert ActiveProposal();
        }
        if (cancellationApprovalCount != members.length) revert UnanimityRequired();

        cancelled = true;
        uint256 refunded;
        for (uint256 i; i < members.length; ++i) {
            address member = members[i];
            uint256 amount = contributions[member];
            if (amount == 0) continue;
            contributions[member] = 0;
            refunded += amount;
            token.safeTransfer(member, amount);
        }
        totalDeposited = 0;
        emit VaultCancelled(refunded);
    }

    function _checkProposal(uint256 id) private view {
        if (id == 0 || id != proposalId || proposal.executed || proposal.cancelled || block.timestamp >= proposal.expiresAt) {
            revert InvalidProposal();
        }
    }

    function snapshot() external view returns (Snapshot memory s) {
        s.name = name;
        s.unlockAt = unlockAt;
        s.chainTimestamp = block.timestamp;
        s.balance = token.balanceOf(address(this));
        s.totalDeposited = totalDeposited;
        s.maxTotalDeposits = maxTotalDeposits;
        s.acceptedCount = acceptedCount;
        s.proposalId = proposalId;
        s.cancellationApprovalCount = cancellationApprovalCount;
        s.cancelled = cancelled;
        s.members = members;
        s.accepted = new bool[](members.length);
        s.contributions = new uint256[](members.length);
        s.approvals = new bool[](members.length);
        s.cancellationApprovals = new bool[](members.length);
        s.proposal = proposal;
        for (uint256 i; i < members.length; ++i) {
            s.accepted[i] = accepted[members[i]];
            s.contributions[i] = contributions[members[i]];
            s.approvals[i] = approved[proposalId][members[i]];
            s.cancellationApprovals[i] = cancellationApproved[members[i]];
        }
    }
}
