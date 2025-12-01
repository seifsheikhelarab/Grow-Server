import express from "express";
import { healthCheck } from "../controllers/misc.controller.js";

const miscRouter = express.Router();

miscRouter.get("/health", healthCheck);

export default miscRouter;
