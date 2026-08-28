const database = db.getSiblingDB(process.env.LIFEGOODS_OFF_DATABASE)

database.createUser({
    user: process.env.LIFEGOODS_OFF_READER_USERNAME,
    pwd: process.env.LIFEGOODS_OFF_READER_PASSWORD,
    roles: [{ role: "read", db: process.env.LIFEGOODS_OFF_DATABASE }],
})

database.createUser({
    user: process.env.LIFEGOODS_OFF_WRITER_USERNAME,
    pwd: process.env.LIFEGOODS_OFF_WRITER_PASSWORD,
    roles: [{ role: "readWrite", db: process.env.LIFEGOODS_OFF_DATABASE }],
})
