// Run only inside the existing MongoDB container. Outputs no records or secrets.
const admin = db.getSiblingDB("admin")
admin.auth(
    process.env.MONGO_INITDB_ROOT_USERNAME,
    process.env.MONGO_INITDB_ROOT_PASSWORD,
)
const off = db.getSiblingDB(
    process.env.LIFEGOODS_OFF_DATABASE || "lifegoods_off",
)
const stats = off.getCollectionNames().map((name) => {
    const s = off.runCommand({ collStats: name })
    return {
        name,
        documents: s.count,
        logicalBytes: s.size,
        storageBytes: s.storageSize,
        indexBytes: s.totalIndexSize,
        indexes: off
            .getCollection(name)
            .getIndexes()
            .map((i) => ({ name: i.name, key: i.key, unique: !!i.unique })),
    }
})
print(
    JSON.stringify(
        {
            database: off.getName(),
            collections: stats,
            snapshots: off.off_dataset_versions
                .find(
                    {},
                    {
                        _id: 1,
                        status: 1,
                        collection_name: 1,
                        search_enabled: 1,
                        search_index: 1,
                    },
                )
                .toArray(),
            active: off.off_dataset_control.findOne({ _id: "active" }),
            users: admin
                .runCommand({
                    usersInfo: { forAllDBs: true },
                    showCredentials: false,
                })
                .users.map((u) => ({ user: u.user, db: u.db, roles: u.roles })),
        },
        null,
        2,
    ),
)
