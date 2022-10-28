import { time } from "@nomicfoundation/hardhat-network-helpers";
import { ethers } from "ethers";
import { v4 } from "uuid";

/**
 * Returns a schema for use in verification
 */
export function verificationSchema() {
  return "verite.id/definitions/processes/kycaml/0.0.1/generic--usa-legal_person";
}

/**
 * Builds an EIP712 'domain' for the contract to be used when signing a payload
 */
export function verificationDomain(contractAddress: string) {
  return {
    name: "PoolAccessControl",
    version: "1.0",
    chainId: 31337,
    verifyingContract: contractAddress
  };
}

/**
 * Builds an EIP712 type object to be used when signing a payload
 */
export function verificationTypes() {
  return {
    VerificationResult: [
      { name: "schema", type: "string" },
      { name: "subject", type: "address" },
      { name: "expiration", type: "uint256" },
      { name: "verifier_verification_id", type: "string" }
    ]
  };
}

type VerificationResult = {
  schema: string;
  subject: string;
  expiration: number;
  verifier_verification_id: string;
};

/**
 * Generate a Verification Result and return the signature
 */
export async function getSignedVerificationResult(
  contractAddress: string,
  subject: string,
  verifier: Pick<ethers.Wallet, "_signTypedData">,
  overwrites?: Partial<VerificationResult>
) {
  const currentTimestamp = await time.latest();

  const verificationResult: VerificationResult = Object.assign(
    {
      schema: verificationSchema(),
      subject,
      expiration: currentTimestamp + 1000,
      verifier_verification_id: v4()
    },
    overwrites
  );

  const signature = await verifier._signTypedData(
    verificationDomain(contractAddress),
    verificationTypes(),
    verificationResult
  );

  return {
    verificationResult,
    signature
  };
}
