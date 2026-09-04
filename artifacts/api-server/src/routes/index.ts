import { Router, type IRouter } from "express";
import healthRouter from "./health";
import imagesRouter from "./images";
import libraryRouter from "./library";
import storageRouter from "./storage";

const router: IRouter = Router();

router.use(healthRouter);
router.use(libraryRouter);
router.use(imagesRouter);
router.use(storageRouter);

export default router;
