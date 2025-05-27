import express from "express";
import multer from "multer";
import {
  getCourse,
  listCourses,
  createCourse,
  updateCourse,
  deleteCourse,
} from "../controllers/courseController";
import { requireAuth } from "@clerk/express";

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.get("/", listCourses);
// see index.ts, we don't have requireAuth middleware yet
router.post("/", requireAuth(), createCourse);

router.get("/:courseId", getCourse);
// Here is where we're going to use multer to allow file/media upload. It stores the file temporarily until we uploaded it into S3 bucket.
// This image upload won't be implemented but we'll use the multer for video upload.
router.put("/:courseId", requireAuth(), upload.single("image"), updateCourse);
router.delete("/:courseId", requireAuth(), deleteCourse);

export default router;
