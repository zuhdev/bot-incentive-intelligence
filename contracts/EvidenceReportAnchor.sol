// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

/// @notice Emits a public timestamped reference to an off-chain evidence report.
/// @dev This event only proves that an account submitted these hashes. It does
///      not validate the report, certify eligibility, or imply BOT Foundation
///      approval. The contract stores no funds and has no privileged caller.
contract EvidenceReportAnchor {
    event EvidenceAnchored(
        bytes32 indexed reportHash,
        bytes32 indexed projectIdentityHash,
        address indexed submitter
    );

    error EmptyReportHash();
    error EmptyProjectIdentityHash();

    function anchor(bytes32 reportHash, bytes32 projectIdentityHash) external {
        if (reportHash == bytes32(0)) revert EmptyReportHash();
        if (projectIdentityHash == bytes32(0)) revert EmptyProjectIdentityHash();
        emit EvidenceAnchored(reportHash, projectIdentityHash, msg.sender);
    }
}
