// WasteRegistry.test.ts
import { describe, expect, it, vi, beforeEach } from "vitest";

// Interfaces for type safety
interface ClarityResponse<T> {
  ok: boolean;
  value: T | number; // number for error codes
}

interface WasteRecord {
  hash: string; // Represent buff as string for simplicity
  owner: string;
  timestamp: number;
  wasteType: string;
  quantity: number;
  unit: string;
  description: string;
  location: string;
}

interface WasteVersion {
  updatedHash: string;
  updateNotes: string;
  timestamp: number;
}

interface WasteCategory {
  category: string;
  tags: string[];
}

interface WasteCollaborator {
  role: string;
  permissions: string[];
  addedAt: number;
}

interface WasteStatus {
  status: string;
  visibility: boolean;
  lastUpdated: number;
}

interface ComplianceNote {
  note: string;
  author: string;
  timestamp: number;
}

interface ContractState {
  wasteRecords: Map<number, WasteRecord>;
  wasteVersions: Map<string, WasteVersion>; // Key as `${wasteId}-${version}`
  wasteCategories: Map<number, WasteCategory>;
  wasteCollaborators: Map<string, WasteCollaborator>; // Key as `${wasteId}-${collaborator}`
  wasteStatus: Map<number, WasteStatus>;
  complianceNotes: Map<string, ComplianceNote>; // Key as `${wasteId}-${noteId}`
  wasteNoteCounters: Map<number, number>;
  contractOwner: string;
  contractPaused: boolean;
  wasteCounter: number;
}

// Mock contract implementation
class WasteRegistryMock {
  private state: ContractState = {
    wasteRecords: new Map(),
    wasteVersions: new Map(),
    wasteCategories: new Map(),
    wasteCollaborators: new Map(),
    wasteStatus: new Map(),
    complianceNotes: new Map(),
    wasteNoteCounters: new Map(),
    contractOwner: "deployer",
    contractPaused: false,
    wasteCounter: 0,
  };

  private ERR_ALREADY_REGISTERED = 1;
  private ERR_NOT_OWNER = 2;
  private ERR_INVALID_HASH = 3;
  private ERR_INVALID_QUANTITY = 4;
  private ERR_INVALID_TYPE = 5;
  private ERR_NOT_AUTHORIZED = 6;
  private ERR_INVALID_VERSION = 7;
  private ERR_MAX_VERSIONS_REACHED = 8;
  private ERR_INVALID_CATEGORY = 9;
  private ERR_INVALID_TAG = 10;
  private ERR_MAX_TAGS_REACHED = 11;
  private ERR_INVALID_ROLE = 12;
  private ERR_MAX_COLLABORATORS = 13;
  private ERR_INVALID_STATUS = 14;
  private ERR_INVALID_NOTE = 15;
  private ERR_PAUSED = 16;
  private ERR_NOT_PAUSED = 17;
  private MAX_VERSIONS = 10;
  private MAX_TAGS = 15;
  private MAX_COLLABORATORS = 5;
  private MAX_NOTE_LENGTH = 500;
  private MAX_DESCRIPTION_LENGTH = 1000;

  private getBlockHeight(): number {
    return Date.now(); // Mock block height
  }

  registerWaste(
    caller: string,
    hash: string,
    wasteType: string,
    quantity: number,
    unit: string,
    description: string,
    location: string
  ): ClarityResponse<number> {
    if (this.state.contractPaused) {
      return { ok: false, value: this.ERR_PAUSED };
    }
    if (hash.length === 0) {
      return { ok: false, value: this.ERR_INVALID_HASH };
    }
    if (quantity <= 0) {
      return { ok: false, value: this.ERR_INVALID_QUANTITY };
    }
    if (wasteType.length === 0) {
      return { ok: false, value: this.ERR_INVALID_TYPE };
    }
    if (description.length > this.MAX_DESCRIPTION_LENGTH) {
      return { ok: false, value: this.ERR_INVALID_NOTE };
    }
    const wasteId = this.state.wasteCounter + 1;
    this.state.wasteRecords.set(wasteId, {
      hash,
      owner: caller,
      timestamp: this.getBlockHeight(),
      wasteType,
      quantity,
      unit,
      description,
      location,
    });
    this.state.wasteStatus.set(wasteId, {
      status: "generated",
      visibility: true,
      lastUpdated: this.getBlockHeight(),
    });
    this.state.wasteCounter = wasteId;
    return { ok: true, value: wasteId };
  }

  updateWasteVersion(
    caller: string,
    wasteId: number,
    newHash: string,
    notes: string
  ): ClarityResponse<number> {
    if (this.state.contractPaused) {
      return { ok: false, value: this.ERR_PAUSED };
    }
    const record = this.state.wasteRecords.get(wasteId);
    if (!record || record.owner !== caller) {
      return { ok: false, value: this.ERR_NOT_OWNER };
    }
    const currentVersion = this.state.wasteNoteCounters.get(wasteId) ?? 0;
    if (currentVersion >= this.MAX_VERSIONS) {
      return { ok: false, value: this.ERR_MAX_VERSIONS_REACHED };
    }
    if (newHash.length === 0) {
      return { ok: false, value: this.ERR_INVALID_HASH };
    }
    const newVersion = currentVersion + 1;
    this.state.wasteVersions.set(`${wasteId}-${newVersion}`, {
      updatedHash: newHash,
      updateNotes: notes,
      timestamp: this.getBlockHeight(),
    });
    this.state.wasteNoteCounters.set(wasteId, newVersion);
    return { ok: true, value: newVersion };
  }

  addWasteCategory(
    caller: string,
    wasteId: number,
    category: string,
    tags: string[]
  ): ClarityResponse<boolean> {
    if (this.state.contractPaused) {
      return { ok: false, value: this.ERR_PAUSED };
    }
    const record = this.state.wasteRecords.get(wasteId);
    if (!record || record.owner !== caller) {
      return { ok: false, value: this.ERR_NOT_OWNER };
    }
    if (category.length === 0) {
      return { ok: false, value: this.ERR_INVALID_CATEGORY };
    }
    if (tags.length > this.MAX_TAGS) {
      return { ok: false, value: this.ERR_MAX_TAGS_REACHED };
    }
    if (tags.some(tag => tag.length === 0)) {
      return { ok: false, value: this.ERR_INVALID_TAG };
    }
    this.state.wasteCategories.set(wasteId, { category, tags });
    return { ok: true, value: true };
  }

  addCollaborator(
    caller: string,
    wasteId: number,
    collaborator: string,
    role: string,
    permissions: string[]
  ): ClarityResponse<boolean> {
    if (this.state.contractPaused) {
      return { ok: false, value: this.ERR_PAUSED };
    }
    const record = this.state.wasteRecords.get(wasteId);
    if (!record || record.owner !== caller) {
      return { ok: false, value: this.ERR_NOT_OWNER };
    }
    const collabKeys = Array.from(this.state.wasteCollaborators.keys()).filter(key => key.startsWith(`${wasteId}-`));
    if (collabKeys.length >= this.MAX_COLLABORATORS) {
      return { ok: false, value: this.ERR_MAX_COLLABORATORS };
    }
    if (role.length === 0) {
      return { ok: false, value: this.ERR_INVALID_ROLE };
    }
    this.state.wasteCollaborators.set(`${wasteId}-${collaborator}`, {
      role,
      permissions,
      addedAt: this.getBlockHeight(),
    });
    return { ok: true, value: true };
  }

  updateWasteStatus(
    caller: string,
    wasteId: number,
    status: string,
    visibility: boolean
  ): ClarityResponse<boolean> {
    if (this.state.contractPaused) {
      return { ok: false, value: this.ERR_PAUSED };
    }
    const record = this.state.wasteRecords.get(wasteId);
    if (!record || record.owner !== caller) {
      return { ok: false, value: this.ERR_NOT_OWNER };
    }
    if (status.length === 0) {
      return { ok: false, value: this.ERR_INVALID_STATUS };
    }
    this.state.wasteStatus.set(wasteId, {
      status,
      visibility,
      lastUpdated: this.getBlockHeight(),
    });
    return { ok: true, value: true };
  }

  addComplianceNote(
    caller: string,
    wasteId: number,
    note: string
  ): ClarityResponse<number> {
    if (this.state.contractPaused) {
      return { ok: false, value: this.ERR_PAUSED };
    }
    const record = this.state.wasteRecords.get(wasteId);
    if (!record) {
      return { ok: false, value: this.ERR_NOT_OWNER };
    }
    const isOwner = record.owner === caller;
    const collab = this.state.wasteCollaborators.get(`${wasteId}-${caller}`);
    const hasPerm = collab && collab.permissions.includes("add-note");
    if (!isOwner && !hasPerm) {
      return { ok: false, value: this.ERR_NOT_AUTHORIZED };
    }
    if (note.length > this.MAX_NOTE_LENGTH) {
      return { ok: false, value: this.ERR_INVALID_NOTE };
    }
    const noteId = (this.state.wasteNoteCounters.get(wasteId) ?? 0) + 1;
    this.state.complianceNotes.set(`${wasteId}-${noteId}`, {
      note,
      author: caller,
      timestamp: this.getBlockHeight(),
    });
    this.state.wasteNoteCounters.set(wasteId, noteId);
    return { ok: true, value: noteId };
  }

  transferOwnership(
    caller: string,
    wasteId: number,
    newOwner: string
  ): ClarityResponse<boolean> {
    if (this.state.contractPaused) {
      return { ok: false, value: this.ERR_PAUSED };
    }
    const record = this.state.wasteRecords.get(wasteId);
    if (!record || record.owner !== caller) {
      return { ok: false, value: this.ERR_NOT_OWNER };
    }
    this.state.wasteRecords.set(wasteId, { ...record, owner: newOwner });
    return { ok: true, value: true };
  }

  pauseContract(caller: string): ClarityResponse<boolean> {
    if (caller !== this.state.contractOwner) {
      return { ok: false, value: this.ERR_NOT_AUTHORIZED };
    }
    if (this.state.contractPaused) {
      return { ok: false, value: this.ERR_NOT_PAUSED };
    }
    this.state.contractPaused = true;
    return { ok: true, value: true };
  }

  unpauseContract(caller: string): ClarityResponse<boolean> {
    if (caller !== this.state.contractOwner) {
      return { ok: false, value: this.ERR_NOT_AUTHORIZED };
    }
    if (!this.state.contractPaused) {
      return { ok: false, value: this.ERR_PAUSED };
    }
    this.state.contractPaused = false;
    return { ok: true, value: true };
  }

  getWasteDetails(wasteId: number): ClarityResponse<WasteRecord | null> {
    return { ok: true, value: this.state.wasteRecords.get(wasteId) ?? null };
  }

  getWasteVersion(wasteId: number, version: number): ClarityResponse<WasteVersion | null> {
    return { ok: true, value: this.state.wasteVersions.get(`${wasteId}-${version}`) ?? null };
  }

  getWasteCategory(wasteId: number): ClarityResponse<WasteCategory | null> {
    return { ok: true, value: this.state.wasteCategories.get(wasteId) ?? null };
  }

  getCollaborator(wasteId: number, collaborator: string): ClarityResponse<WasteCollaborator | null> {
    return { ok: true, value: this.state.wasteCollaborators.get(`${wasteId}-${collaborator}`) ?? null };
  }

  getWasteStatus(wasteId: number): ClarityResponse<WasteStatus | null> {
    return { ok: true, value: this.state.wasteStatus.get(wasteId) ?? null };
  }

  getComplianceNote(wasteId: number, noteId: number): ClarityResponse<ComplianceNote | null> {
    return { ok: true, value: this.state.complianceNotes.get(`${wasteId}-${noteId}`) ?? null };
  }

  verifyWaste(wasteId: number, hash: string): ClarityResponse<boolean> {
    const record = this.state.wasteRecords.get(wasteId);
    return { ok: true, value: !!record && record.hash === hash };
  }

  isPaused(): ClarityResponse<boolean> {
    return { ok: true, value: this.state.contractPaused };
  }

  getWasteCounter(): ClarityResponse<number> {
    return { ok: true, value: this.state.wasteCounter };
  }
}

// Test setup
const accounts = {
  deployer: "deployer",
  company1: "company_1",
  company2: "company_2",
  inspector: "inspector_1",
};

describe("WasteRegistry Contract", () => {
  let contract: WasteRegistryMock;

  beforeEach(() => {
    contract = new WasteRegistryMock();
    vi.resetAllMocks();
  });

  it("should allow company to register waste", () => {
    const result = contract.registerWaste(
      accounts.company1,
      "hash123",
      "chemical",
      500,
      "kg",
      "Hazardous waste from factory",
      "Factory A"
    );
    expect(result).toEqual({ ok: true, value: 1 });
    const details = contract.getWasteDetails(1);
    expect(details.value).toEqual(expect.objectContaining({
      hash: "hash123",
      owner: accounts.company1,
      wasteType: "chemical",
      quantity: 500,
      unit: "kg",
      description: "Hazardous waste from factory",
      location: "Factory A",
    }));
    const status = contract.getWasteStatus(1);
    expect(status.value).toEqual(expect.objectContaining({ status: "generated", visibility: true }));
  });

  it("should prevent registration with invalid hash", () => {
    const result = contract.registerWaste(
      accounts.company1,
      "",
      "chemical",
      500,
      "kg",
      "Hazardous waste",
      "Factory A"
    );
    expect(result).toEqual({ ok: false, value: 3 });
  });

  it("should prevent registration with zero quantity", () => {
    const result = contract.registerWaste(
      accounts.company1,
      "hash123",
      "chemical",
      0,
      "kg",
      "Hazardous waste",
      "Factory A"
    );
    expect(result).toEqual({ ok: false, value: 4 });
  });

  it("should prevent registration with empty waste type", () => {
    const result = contract.registerWaste(
      accounts.company1,
      "hash123",
      "",
      500,
      "kg",
      "Hazardous waste",
      "Factory A"
    );
    expect(result).toEqual({ ok: false, value: 5 });
  });

  it("should prevent registration with oversized description", () => {
    const result = contract.registerWaste(
      accounts.company1,
      "hash123",
      "chemical",
      500,
      "kg",
      "a".repeat(1001),
      "Factory A"
    );
    expect(result).toEqual({ ok: false, value: 15 });
  });

  it("should prevent registration when paused", () => {
    contract.pauseContract(accounts.deployer);
    const result = contract.registerWaste(
      accounts.company1,
      "hash123",
      "chemical",
      500,
      "kg",
      "Hazardous waste",
      "Factory A"
    );
    expect(result).toEqual({ ok: false, value: 16 });
  });

  it("should allow owner to update waste version", () => {
    contract.registerWaste(
      accounts.company1,
      "hash123",
      "chemical",
      500,
      "kg",
      "Hazardous waste",
      "Factory A"
    );
    const result = contract.updateWasteVersion(accounts.company1, 1, "newhash456", "Updated quantity");
    expect(result).toEqual({ ok: true, value: 1 });
    const version = contract.getWasteVersion(1, 1);
    expect(version.value).toEqual(expect.objectContaining({ updatedHash: "newhash456", updateNotes: "Updated quantity" }));
  });

  it("should prevent non-owner from updating version", () => {
    contract.registerWaste(
      accounts.company1,
      "hash123",
      "chemical",
      500,
      "kg",
      "Hazardous waste",
      "Factory A"
    );
    const result = contract.updateWasteVersion(accounts.company2, 1, "newhash456", "Unauthorized update");
    expect(result).toEqual({ ok: false, value: 2 });
  });

  it("should prevent version update with invalid hash", () => {
    contract.registerWaste(
      accounts.company1,
      "hash123",
      "chemical",
      500,
      "kg",
      "Hazardous waste",
      "Factory A"
    );
    const result = contract.updateWasteVersion(accounts.company1, 1, "", "Invalid hash");
    expect(result).toEqual({ ok: false, value: 3 });
  });

  it("should prevent version update beyond max versions", () => {
    contract.registerWaste(
      accounts.company1,
      "hash123",
      "chemical",
      500,
      "kg",
      "Hazardous waste",
      "Factory A"
    );
    for (let i = 0; i < 10; i++) {
      contract.updateWasteVersion(accounts.company1, 1, `hash${i}`, `Note ${i}`);
    }
    const result = contract.updateWasteVersion(accounts.company1, 1, "newhash", "Too many versions");
    expect(result).toEqual({ ok: false, value: 8 });
  });

  it("should allow owner to add category", () => {
    contract.registerWaste(
      accounts.company1,
      "hash123",
      "chemical",
      500,
      "kg",
      "Hazardous waste",
      "Factory A"
    );
    const result = contract.addWasteCategory(accounts.company1, 1, "hazardous", ["toxic", "flammable"]);
    expect(result).toEqual({ ok: true, value: true });
    const category = contract.getWasteCategory(1);
    expect(category.value).toEqual({ category: "hazardous", tags: ["toxic", "flammable"] });
  });

  it("should prevent non-owner from adding category", () => {
    contract.registerWaste(
      accounts.company1,
      "hash123",
      "chemical",
      500,
      "kg",
      "Hazardous waste",
      "Factory A"
    );
    const result = contract.addWasteCategory(accounts.company2, 1, "hazardous", ["toxic"]);
    expect(result).toEqual({ ok: false, value: 2 });
  });

  it("should prevent adding category with empty tags", () => {
    contract.registerWaste(
      accounts.company1,
      "hash123",
      "chemical",
      500,
      "kg",
      "Hazardous waste",
      "Factory A"
    );
    const result = contract.addWasteCategory(accounts.company1, 1, "hazardous", ["toxic", ""]);
    expect(result).toEqual({ ok: false, value: 10 });
  });

  it("should allow owner to add collaborator", () => {
    contract.registerWaste(
      accounts.company1,
      "hash123",
      "chemical",
      500,
      "kg",
      "Hazardous waste",
      "Factory A"
    );
    const result = contract.addCollaborator(accounts.company1, 1, accounts.inspector, "inspector", ["view", "add-note"]);
    expect(result).toEqual({ ok: true, value: true });
    const collab = contract.getCollaborator(1, accounts.inspector);
    expect(collab.value).toEqual(expect.objectContaining({ role: "inspector", permissions: ["view", "add-note"] }));
  });

  it("should prevent adding collaborator beyond max limit", () => {
    contract.registerWaste(
      accounts.company1,
      "hash123",
      "chemical",
      500,
      "kg",
      "Hazardous waste",
      "Factory A"
    );
    for (let i = 1; i <= 5; i++) {
      contract.addCollaborator(accounts.company1, 1, `inspector_${i}`, "inspector", ["view"]);
    }
    const result = contract.addCollaborator(accounts.company1, 1, accounts.inspector, "inspector", ["view"]);
    expect(result).toEqual({ ok: false, value: 13 });
  });

  it("should allow collaborator with permission to add compliance note", () => {
    contract.registerWaste(
      accounts.company1,
      "hash123",
      "chemical",
      500,
      "kg",
      "Hazardous waste",
      "Factory A"
    );
    contract.addCollaborator(accounts.company1, 1, accounts.inspector, "inspector", ["add-note"]);
    const result = contract.addComplianceNote(accounts.inspector, 1, "Compliance check passed");
    expect(result).toEqual({ ok: true, value: 1 });
    const note = contract.getComplianceNote(1, 1);
    expect(note.value).toEqual(expect.objectContaining({ note: "Compliance check passed", author: accounts.inspector }));
  });

  it("should prevent unauthorized user from adding note", () => {
    contract.registerWaste(
      accounts.company1,
      "hash123",
      "chemical",
      500,
      "kg",
      "Hazardous waste",
      "Factory A"
    );
    const result = contract.addComplianceNote(accounts.company2, 1, "Unauthorized note");
    expect(result).toEqual({ ok: false, value: 6 });
  });

  it("should prevent adding oversized compliance note", () => {
    contract.registerWaste(
      accounts.company1,
      "hash123",
      "chemical",
      500,
      "kg",
      "Hazardous waste",
      "Factory A"
    );
    const result = contract.addComplianceNote(accounts.company1, 1, "a".repeat(501));
    expect(result).toEqual({ ok: false, value: 15 });
  });

  it("should allow owner to transfer ownership", () => {
    contract.registerWaste(
      accounts.company1,
      "hash123",
      "chemical",
      500,
      "kg",
      "Hazardous waste",
      "Factory A"
    );
    const result = contract.transferOwnership(accounts.company1, 1, accounts.company2);
    expect(result).toEqual({ ok: true, value: true });
    const details = contract.getWasteDetails(1);
    expect(details.value).toEqual(expect.objectContaining({ owner: accounts.company2 }));
  });

  it("should prevent non-owner from transferring ownership", () => {
    contract.registerWaste(
      accounts.company1,
      "hash123",
      "chemical",
      500,
      "kg",
      "Hazardous waste",
      "Factory A"
    );
    const result = contract.transferOwnership(accounts.company2, 1, accounts.inspector);
    expect(result).toEqual({ ok: false, value: 2 });
  });

  it("should allow deployer to pause and unpause contract", () => {
    const pauseResult = contract.pauseContract(accounts.deployer);
    expect(pauseResult).toEqual({ ok: true, value: true });
    expect(contract.isPaused()).toEqual({ ok: true, value: true });

    const unpauseResult = contract.unpauseContract(accounts.deployer);
    expect(unpauseResult).toEqual({ ok: true, value: true });
    expect(contract.isPaused()).toEqual({ ok: true, value: false });
  });

  it("should prevent non-deployer from pausing contract", () => {
    const pauseResult = contract.pauseContract(accounts.company1);
    expect(pauseResult).toEqual({ ok: false, value: 6 });
  });

  it("should prevent pausing already paused contract", () => {
    contract.pauseContract(accounts.deployer);
    const pauseResult = contract.pauseContract(accounts.deployer);
    expect(pauseResult).toEqual({ ok: false, value: 17 });
  });

  it("should verify waste hash correctly", () => {
    contract.registerWaste(
      accounts.company1,
      "hash123",
      "chemical",
      500,
      "kg",
      "Hazardous waste",
      "Factory A"
    );
    const result = contract.verifyWaste(1, "hash123");
    expect(result).toEqual({ ok: true, value: true });

    const invalidResult = contract.verifyWaste(1, "wronghash");
    expect(invalidResult).toEqual({ ok: true, value: false });
  });

  it("should return null for non-existent waste details", () => {
    const details = contract.getWasteDetails(999);
    expect(details).toEqual({ ok: true, value: null });
  });
});