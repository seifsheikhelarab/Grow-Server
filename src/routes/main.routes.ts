import express from "express";

const router = express.Router();

import miscRouter from "./misc.routes.js";


router.use(miscRouter);


export default router;
