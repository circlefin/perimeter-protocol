/*
 * Copyright (c) 2023, Circle Internet Financial Limited.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// import hre from "hardhat";
import fetch from "cross-fetch";
import type { PresentationDefinition } from "verite";
import jwt from "jsonwebtoken";

/**
 * ================================================================
 * CONFIGURATION
 * ================================================================
 */
// The Chain ID for the network you are using (1 = mainnet, 5 = goerli)
const CHAIN_ID = 5;
// The contract address (PoolAdminAccessControl, etc).
// Default is the Goerli PoolAdminAccessControl address.
const CONTRACT_ADDRESS = "0x3b380e8d02A068ae779b73c7E24c2d18a176BbAD";
// The subject of the VC (the address of the user)
const SUBJECT = "";
// The Verifiable credential JWT for this address
const VC_JWT = "";
// The Circle verifier host
const VERIFIER_HOST = "https://verifier-sandbox.circle.com/api/v1";

/**
 * Optional config: You likely do not need to change anything below this line.
 */
const NETWORK = "ethereum";
const DID = `did:pkh:eip155:1:${SUBJECT}`;
const NAME = "VerificationRegistry";
const VERSION = "1.0";

/**
 * Performs an API request to the verifier
 */
async function _apiRequest(url: string, init: RequestInit = {}) {
  const options = {
    headers: {
      accept: "application/json",
      "content-type": "application/json"
    },
    ...init
  };

  console.log(` > ${init.method ?? "GET"} ${url} ...`);
  const resp = await fetch(url, options);

  if (!resp.ok) {
    const errJson = await resp.json();
    console.error(errJson);
    throw new Error(`API request failed: ${resp.status} ${resp.statusText}`);
  }

  return resp.json();
}

/**
 * Step 1. POST /verifications
 */

type CreateVerificationResult = {
  challengeTokenUrl: string;
  statusUrl: string;
};

async function createVerification(): Promise<CreateVerificationResult> {
  return _apiRequest(`${VERIFIER_HOST}/verifications`, {
    method: "POST",
    body: JSON.stringify({
      network: NETWORK,
      chainId: CHAIN_ID,
      subject: SUBJECT,
      name: NAME,
      version: VERSION,
      registryAddress: CONTRACT_ADDRESS
    })
  });
}

/**
 * Step 2. Get the verification offer
 */

type VerificationOffer = {
  id: string;
  type: string;
  from: string;
  created_time: string;
  expires_time: string;
  reply_url: string;
  body: {
    status_url: string;
    challenge: string;
    presentation_definition: PresentationDefinition;
  };
};

async function fetchVerificationOffer(
  challengeTokenUrl: string
): Promise<VerificationOffer> {
  return _apiRequest(challengeTokenUrl);
}

/**
 * Step 3: Submit credential for verification
 */
async function submitCredential(offer: VerificationOffer) {
  const submission = {
    credential_fulfillment: {
      descriptor_map: [
        {
          format: "jwt_vc",
          id: "proofOfIdentifierControlVP",
          path: "$.presentation.credential[0]"
        }
      ],
      id: "e921d5b2-5293-4297-a467-907f9d565e4e",
      manifest_id: "KYBPAMLAttestation"
    },
    presentation_submission: {
      id: "b68fda51-21aa-4cdf-84b7-d452b1c9c3cc",
      definition_id: offer.body.presentation_definition.id,
      descriptor_map: [
        {
          format: "jwt_vc",
          id: "kybpaml_input",
          path: "$.verifiableCredential[0]"
        }
      ]
    },
    vp: {
      "@context": ["https://www.w3.org/2018/credentials/v1"],
      type: ["VerifiablePresentation", "CredentialFulfillment"],
      verifiableCredential: [VC_JWT],
      holder: DID
    },
    nonce: offer.body.challenge,
    sub: SUBJECT,
    iss: DID
  };

  const data = jwt.sign(submission, "", { algorithm: "none" });
  console.log("JWT data:", data);

  return _apiRequest(offer.reply_url, {
    method: "POST",
    body: data,
    headers: {
      "Content-Type": "text/plain"
    }
  });
}

/**
 * Main function
 */
async function main() {
  if (!SUBJECT.length) {
    throw new Error("Please set the SUBJECT config variable");
  }

  if (!CONTRACT_ADDRESS.length) {
    throw new Error("Please set the CONTRACT_ADDRESS config variable");
  }

  if (!VC_JWT.length) {
    throw new Error("Please set the VC_JWT config variable");
  }

  // 1. POST to /verifications
  console.log("\nStep 1:");
  const verification = await createVerification();
  console.log(verification);

  console.log("\nStep 2:");
  const offer = await fetchVerificationOffer(verification.challengeTokenUrl);
  console.log(offer);

  console.log("\nStep 3:");
  const result = await submitCredential(offer);
  console.log(result);

  console.log("\n\nVerification result:\n\n");
  const { verificationResult, signature } = result;
  console.log({ verificationResult, signature });
  console.log("\n\n");
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
