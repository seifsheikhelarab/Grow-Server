import { PrismaClient, NotificationType, TxStatus, CommissionStatus } from "@prisma/client";
import * as bcrypt from "bcrypt";
import { faker } from "@faker-js/faker";

const prisma = new PrismaClient();

// Helper to generate Egyptian phone numbers
function generateEgyptianPhone(): string {
    const prefixes = ["010", "011", "012", "015"];
    const prefix = faker.helpers.arrayElement(prefixes);
    return prefix + faker.string.numeric(8);
}

async function main() {
    console.log("Starting seed...");

    // 1. Clean up existing data
    await prisma.notification.deleteMany();
    await prisma.auditLog.deleteMany();
    await prisma.systemSetting.deleteMany();
    await prisma.otp.deleteMany();
    await prisma.goal.deleteMany();
    await prisma.kioskDue.deleteMany();
    await prisma.redemptionRequest.deleteMany();
    await prisma.transaction.deleteMany();
    await prisma.workerProfile.deleteMany();
    await prisma.kiosk.deleteMany();
    await prisma.wallet.deleteMany();
    await prisma.shadowWallet.deleteMany();
    await prisma.user.deleteMany();

    console.log("Cleaned up database.");

    const passwordHash = await bcrypt.hash("password123", 10);

    // 2. Create System Settings
    await prisma.systemSetting.createMany({
        data: [
            { key: "commission_rate", value: "5", description: "Default commission points per transaction" },
            { key: "min_redemption", value: "50", description: "Minimum points for redemption" },
            { key: "max_daily_tx", value: "150", description: "Maximum daily transactions per worker" },
            { key: "maintenance_mode", value: "false", description: "System maintenance mode status" },
            { key: "max_kiosks", value: "10", description: "Maximum number of kiosks per owner" },
            { key: "max_transaction_amount", value: "100", description: "Maximum transaction amount" },
            { key: "max_daily_tx_to_customer", value: "2", description: "Maximum daily transactions to same customer" },
        ]
    });
    console.log("System settings created.");

    // 3. Create Admins
    const superAdmin = await prisma.user.create({
        data: {
            full_name: faker.person.fullName(),
            phone: "01000000000",
            password_hash: passwordHash,
            role: "ADMIN",
            admin_role: "SUPER_ADMIN",
            is_active: true,
            is_verified: true,
            wallet: { create: { balance: 0 } }
        }
    });

    await prisma.user.create({
        data: {
            full_name: faker.person.fullName(),
            phone: "01000000001",
            password_hash: passwordHash,
            role: "ADMIN",
            admin_role: "EDITOR",
            is_active: true,
            is_verified: true,
            wallet: { create: { balance: 0 } }
        }
    });

    const viewerAdmin = await prisma.user.create({
        data: {
            full_name: faker.person.fullName(),
            phone: "01000000002",
            password_hash: passwordHash,
            role: "ADMIN",
            admin_role: "VIEWER",
            is_active: true,
            is_verified: true,
            wallet: { create: { balance: 0 } }
        }
    });
    console.log("Admins created.");

    // 4. Create Owners
    const owners = [];
    for (let i = 0; i < 5; i++) {
        const owner = await prisma.user.create({
            data: {
                full_name: faker.person.fullName(),
                phone: `0110000000${i}`,
                password_hash: passwordHash,
                role: "OWNER",
                is_active: true,
                is_verified: true,
                wallet: { create: { balance: faker.number.float({ min: 1000, max: 50000, fractionDigits: 2 }) } }
            }
        });
        owners.push(owner);
    }
    console.log("Owners created.");

    // 5. Create Kiosks
    const kioskTypes = ["Supermarket", "Pharmacy", "Electronics", "Grocery", "Convenience Store"];
    const kiosks: Awaited<ReturnType<typeof prisma.kiosk.create>>[] = [];
    for (const owner of owners) {
        const numKiosks = faker.number.int({ min: 1, max: 3 });
        for (let i = 0; i < numKiosks; i++) {
            const kiosk = await prisma.kiosk.create({
                data: {
                    name: faker.company.name(),
                    kiosk_type: faker.helpers.arrayElement(kioskTypes),
                    owner_id: owner.id
                }
            });
            kiosks.push(kiosk);
        }
    }
    console.log("Kiosks created.");

    // 6. Create Workers
    const workers = [];
    for (let i = 0; i < 15; i++) {
        const kiosk = faker.helpers.arrayElement(kiosks);
        const status = faker.helpers.arrayElement(["ACTIVE", "ACTIVE", "ACTIVE", "PENDING_INVITE"]);
        const worker = await prisma.user.create({
            data: {
                full_name: faker.person.fullName(),
                phone: `012${(10000000 + i).toString()}`,
                password_hash: status === "ACTIVE" ? passwordHash : null,
                role: "WORKER",
                is_active: true,
                is_verified: status === "ACTIVE",
                wallet: { create: { balance: faker.number.float({ min: 0, max: 1000, fractionDigits: 2 }) } },
                worker_profiles: {
                    create: {
                        kiosk_id: kiosk.id,
                        name: faker.person.firstName(),
                        status: status,
                    }
                }
            },
            include: {
                worker_profiles: true
            }
        });

        // Push the first profile (default)
        workers.push({ user: worker, kiosk, profile: worker.worker_profiles[0] });
    }

    // 6.5 Create Multi-Kiosk Worker (Test Case)
    if (kiosks.length >= 2) {
        const kiosk1 = kiosks[0];
        const kiosk2 = kiosks[1];

        const multiWorker = await prisma.user.create({
            data: {
                full_name: "Multi Kiosk Worker",
                phone: "01299999999",
                password_hash: passwordHash,
                role: "WORKER",
                is_active: true,
                is_verified: true,
                wallet: { create: { balance: 0 } },
                worker_profiles: {
                    create: [
                        { kiosk_id: kiosk1.id, name: "Profile 1", status: "ACTIVE" },
                        { kiosk_id: kiosk2.id, name: "Profile 2", status: "ACTIVE" }
                    ]
                }
            },
            include: { worker_profiles: true }
        });

        // Add both profiles to workers array for transaction generation
        workers.push({ user: multiWorker, kiosk: kiosk1, profile: multiWorker.worker_profiles[0] });
        workers.push({ user: multiWorker, kiosk: kiosk2, profile: multiWorker.worker_profiles[1] });

        console.log("Multi-kiosk worker created (01299999999)");
    }

    console.log("Workers created.");

    // 7. Create Customers
    const customers = [];
    for (let i = 0; i < 20; i++) {
        const customer = await prisma.user.create({
            data: {
                full_name: faker.person.fullName(),
                phone: `015${(20000000 + i).toString()}`,
                password_hash: passwordHash,
                role: "CUSTOMER",
                is_active: true,
                is_verified: true,
                wallet: { create: { balance: faker.number.float({ min: 0, max: 500, fractionDigits: 2 }) } }
            }
        });
        customers.push(customer);
    }
    console.log("Customers created.");

    // 8. Create Goals
    // Customer saving goals
    for (let i = 0; i < 10; i++) {
        const customer = faker.helpers.arrayElement(customers);
        const kiosk = faker.helpers.arrayElement(kiosks);
        await prisma.goal.create({
            data: {
                user_id: customer.id,
                kiosk_id: kiosk.id,
                title: faker.helpers.arrayElement(["New Phone", "Vacation", "Emergency Fund", "New Laptop", "Gift"]),
                target_amount: faker.number.float({ min: 100, max: 5000, fractionDigits: 2 }),
                type: "SAVING",
                deadline: faker.date.future({ years: 1 })
            }
        });
    }

    // Kiosk target goals (applied to all workers in kiosk)
    for (const kiosk of kiosks) {
        const owner = owners.find(o => o.id === kiosk.owner_id);
        await prisma.goal.create({
            data: {
                // user_id left null as it applies to kiosk
                owner_id: owner?.id,
                kiosk_id: kiosk.id,
                title: "Daily Commission Target",
                target_amount: faker.number.float({ min: 50, max: 200, fractionDigits: 2 }),
                type: "WORKER_TARGET",
                is_recurring: true,
                status: "ACTIVE"
            }
        });
    }
    console.log("Goals created.");

    // 9. Create Transactions
    const txStatuses: TxStatus[] = ["COMPLETED", "COMPLETED", "COMPLETED", "COMPLETED", "FAILED"];
    const commissionStatuses: CommissionStatus[] = ["PAID", "PAID", "PENDING", "FORFEITED"];
    for (let i = 0; i < 100; i++) { // Increase transactions
        const { user: worker, kiosk, profile } = faker.helpers.arrayElement(workers);
        const customer = faker.helpers.arrayElement(customers);
        const amount = faker.number.float({ min: 10, max: 100, fractionDigits: 2 });
        const status = faker.helpers.arrayElement(txStatuses);

        await prisma.transaction.create({
            data: {
                sender_id: worker.id,
                receiver_phone: customer.phone,
                receiver_id: customer.id,
                kiosk_id: kiosk.id,
                workerprofile_id: profile.id, // Link to profile
                amount_gross: amount,
                amount_net: amount - 5,
                commission: 5,
                type: "DEPOSIT",
                status: status,
                commission_status: status === "COMPLETED"
                    ? faker.helpers.arrayElement(commissionStatuses)
                    : "FORFEITED",
                created_at: faker.date.recent({ days: 30 })
            }
        });
    }
    console.log("Transactions created.");

    // 10. Create Redemption Requests
    const redemptionMethods = ["Vodafone Cash", "Instapay", "Orange Cash", "Etisalat Cash"];
    const redemptionStatuses: TxStatus[] = ["PENDING", "PENDING", "COMPLETED", "REJECTED"];
    for (let i = 0; i < 15; i++) {
        const user = faker.helpers.arrayElement([...customers, ...workers.map(w => w.user)]);
        await prisma.redemptionRequest.create({
            data: {
                user_id: user.id,
                amount: faker.number.float({ min: 50, max: 500, fractionDigits: 2 }),
                method: faker.helpers.arrayElement(redemptionMethods),
                details: generateEgyptianPhone(),
                type: faker.helpers.arrayElement(["E-Wallet", "Bank Transfer"]),
                status: faker.helpers.arrayElement(redemptionStatuses),
                admin_note: faker.datatype.boolean() ? faker.lorem.sentence() : null,
                created_at: faker.date.recent({ days: 14 })
            }
        });
    }
    console.log("Redemption requests created.");

    // 11. Create Kiosk Dues
    for (const kiosk of kiosks) {
        const numDues = faker.number.int({ min: 1, max: 5 });
        for (let i = 0; i < numDues; i++) {
            await prisma.kioskDue.create({
                data: {
                    kiosk_id: kiosk.id,
                    amount: faker.number.float({ min: 100, max: 2000, fractionDigits: 2 }),
                    is_paid: faker.datatype.boolean(),
                    collected_by: faker.datatype.boolean() ? viewerAdmin.id : null,
                    created_at: faker.date.recent({ days: 30 })
                }
            });
        }
    }
    console.log("Kiosk dues created.");

    // 12. Create Notifications
    const notificationTypes: NotificationType[] = [
        "WORKER_INVITATION_SENT",
        "WORKER_INVITATION_RESPONSE",
        "REDEMPTION_REQUEST_NEW",
        "REDEMPTION_REQUEST_PROCESSED",
        "TRANSACTION_COMPLETED",
        "KIOSK_CREATED",
        "DUE_PENDING"
    ];

    // Owner notifications
    for (const owner of owners) {
        for (let i = 0; i < faker.number.int({ min: 3, max: 8 }); i++) {
            const type = faker.helpers.arrayElement(notificationTypes);
            await prisma.notification.create({
                data: {
                    user_id: owner.id,
                    title: faker.lorem.words(3),
                    message: faker.lorem.sentence(),
                    type: type,
                    read: faker.datatype.boolean(),
                    created_at: faker.date.recent({ days: 7 })
                }
            });
        }
    }

    // Worker notifications
    for (const { user: worker } of workers) {
        for (let i = 0; i < faker.number.int({ min: 1, max: 5 }); i++) {
            const type = faker.helpers.arrayElement([
                "WORKER_INVITATION_SENT",
                "TRANSACTION_COMPLETED",
                "REDEMPTION_REQUEST_PROCESSED"
            ] as NotificationType[]);
            await prisma.notification.create({
                data: {
                    user_id: worker.id,
                    title: faker.lorem.words(3),
                    message: faker.lorem.sentence(),
                    type: type,
                    read: faker.datatype.boolean(),
                    created_at: faker.date.recent({ days: 7 })
                }
            });
        }
    }
    console.log("Notifications created.");

    // 13. Create Audit Logs
    const auditActions = ["VIEW_DASHBOARD", "PROCESS_REDEMPTION", "COLLECT_DUE", "UPDATE_SETTING"];
    for (let i = 0; i < 20; i++) {
        await prisma.auditLog.create({
            data: {
                admin_id: faker.helpers.arrayElement([superAdmin.id, viewerAdmin.id]),
                action: faker.helpers.arrayElement(auditActions),
                target_id: faker.string.uuid(),
                details: JSON.stringify({ details: faker.lorem.sentence() }),
                ip_address: faker.internet.ip(),
                created_at: faker.date.recent({ days: 30 })
            }
        });
    }
    console.log("Audit logs created.");

    // 14. Create Shadow Wallets
    for (let i = 0; i < 10; i++) {
        await prisma.shadowWallet.create({
            data: {
                phone: generateEgyptianPhone(),
                balance: faker.number.float({ min: 10, max: 200, fractionDigits: 2 })
            }
        });
    }
    console.log("Shadow wallets created.");

    console.log("Seed completed successfully!");
}

main()
    .then(() => {
        process.exit(0);
    })
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
