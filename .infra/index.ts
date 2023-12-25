// Guide: https://foundryvtt.wiki/en/setup/hosting/always-free-oracle
// Infra source: https://www.pulumi.com/ai/conversations/009a2237-06d6-4f38-af65-6b8a2b799986?prompt=Create+an+oci.ComputeCloud.AtCustomerCccInfrastructure+resource
import * as oci from "@pulumi/oci";

const compartmentId = "something-hardcoded"

// Create a new Virtual Cloud Network (VCN)
const vcn = new oci.core.VirtualNetwork("myVcn", {
    cidrBlock: "10.0.0.0/16",
    displayName: "my-vcn",
    dnsLabel: "myvcn",
    compartmentId: oci.getCompartment().then(c => c.id),
});

// Define Security List (Security Policy) for the VCN
const securityList = new oci.core.SecurityList("mySecurityList", {
    compartmentId: oci.getCompartment().then(c => c.id),
    vcnId: vcn.id,
    egressSecurityRules: [
        {
            destination: "0.0.0.0/0",
            protocol: "all",
        },
    ],
    ingressSecurityRules: [
        {
            source: "0.0.0.0/0",
            protocol: "all",
        },
    ],
});

// Create a Compute Virtual Machine Instance
const instance = new oci.core.Instance("myInstance", {
    availabilityDomain: "Uocm:US-ASHBURN-AD-1",
    shape: "VM.Standard.A1.Flex",
    // Attaching VCN subnet to the instance
    createVnicDetails: {
        subnetId: vcn.defaultSecurityListId,
    },
    compartmentId: oci.getCompartment().then(c => c.id),
    metadata: {
        ssh_authorized_keys: "your-public-key",
    },
    shapeConfig: {
        // Specify OCPUs and Memory for the instance shape
        memoryInGbs: 4,
        ocpus: 1,
    },
});

// Create a boot volume with the specified size
const bootVolume = new oci.core.BootVolume("myBootVolume", {
    availabilityDomain: instance.availabilityDomain,
    sizeInGbs: 200,
    sourceDetails: {
        type: "instance",
        id: instance.id,
    },
    compartmentId: oci.getCompartment().then(c => c.id),
});

// Create a Volume Backup Policy and attach to the boot volume
const backupPolicy = new oci.core.VolumeBackupPolicy("myBackupPolicy", {
    compartmentId: oci.getCompartment().then(c => c.id),
    schedules: [{
        backupType: "FULL",
        period: "ONE_MONTH",
        retentionSeconds: 2592000, // 30 days
    }],
});
new oci.core.VolumeBackupPolicyAssignment("myBackupPolicyAssignment", {
    assetId: bootVolume.id,
    policyId: backupPolicy.id,
});

// Create a Budget and Cost Analysis policy
const budget = new oci.budget.Budget("myBudget", {
    compartmentId: oci.getCompartment().then(c => c.id),
    amount: 1,
    budgetProcessingPeriodStartOffset: 0, // Start immediately
    resetPeriod: "MONTHLY",
    targetType: "COMPARTMENT",
    targets: [oci.getCompartment().then(c => c.id)],
    // Alert when the forecasted cost exceeds 1% tolerance
    alertRule: {
        type: "ACTUAL",
        threshold: 1,
        thresholdType: "PERCENTAGE",
        recipients: "user@example.com", // Change to your alert email
    },
});

// Export the VCN ID, Compute Instance ID, and Budget ID
export const vcnId = vcn.id;
export const instanceId = instance.id;
export const budgetId = budget.id;