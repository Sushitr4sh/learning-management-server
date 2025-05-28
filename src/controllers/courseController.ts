import { Request, Response } from "express";
import Course from "../models/courseModel";
import AWS from "aws-sdk";
import { v4 as uuidv4 } from "uuid";
import { title } from "process";
import { getAuth } from "@clerk/express";

const s3 = new AWS.S3();

export const listCourses = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { category } = req.query;
  try {
    const courses =
      category && category !== "all"
        ? await Course.scan("category").eq(category).exec()
        : await Course.scan().exec();
    /* When we set this response, we have the message and data key. But when we fetch it on RTK query,this object is being stored inside anoter variable. If you just want to access the course, you can see the custom query setup on api.ts */
    res.json({ message: "Courses retrieved successfully", data: courses });
  } catch (error) {
    res.status(500).json({ message: "Error retrieving courses", error });
  }
};

export const getCourse = async (req: Request, res: Response): Promise<void> => {
  const { courseId } = req.params;
  try {
    const course = await Course.get(courseId);
    if (!course) {
      res.status(404).json({ message: "Course not found" });
      return;
    }
    res.json({ message: "Course retrieved successfully", data: course });
  } catch (error) {
    res.status(500).json({ message: "Error retrieving course", error });
  }
};

export const createCourse = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { teacherId, teacherName } = req.body;
  try {
    if (!teacherId || !teacherName) {
      res.status(400).json({ message: "Teacher Id and name are required" });
      return;
    }

    const newCourse = new Course({
      courseId: uuidv4(),
      teacherId,
      teacherName,
      title: "Untitled Course",
      description: "",
      category: "Uncategorized",
      image: "",
      price: 0,
      level: "Beginner",
      status: "Draft",
      sections: [],
      enrollments: [],
    });

    await newCourse.save();

    res.json({ message: "Course created successfully", data: newCourse });
  } catch (error) {
    res.status(500).json({ message: "Error creating course", error });
  }
};

export const updateCourse = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { courseId } = req.params;
  const updateData = { ...req.body };
  const { userId } = getAuth(req);
  try {
    // Get the recently created draft course
    const course = await Course.get(courseId);
    if (!course) {
      res.status(404).json({ message: "Course not found" });
      return;
    }

    // Make sure the currently logged in user is the teacher of the course
    if (course.teacherId !== userId) {
      res.status(403).json({ message: "Not authorized to update this course" });
      return;
    }

    // $15.00 -> 1500
    if (updateData.price) {
      const price = parseInt(updateData.price);
      if (isNaN(price)) {
        res.status(400).json({
          message: "Invalid price format",
          error: "Price must be a valid number",
        });
        return;
      }
      updateData.price = price * 100;
    }

    // It's possible that our sections is a parsed version of the sections which is a bunch of array
    if (updateData.sections) {
      const sectionsData =
        typeof updateData.sections === "string"
          ? JSON.parse(updateData.sections)
          : updateData.sections;

      // Remove the id in case we want to replace it
      // We cycle through every section, make sure we update the data, then we can replace with whatever information we need
      // Because it is very nested, and in case we want to update sections/chapters we need to do this
      updateData.sections = sectionsData.map((section: any) => ({
        ...section,
        sectionId: section.sectionId || uuidv4(),
        chapters: section.chapters.map((chapter: any) => ({
          ...chapter,
          chapterId: chapter.chapterId || uuidv4(),
        })),
      }));
    }

    // We're also going to replicate the object and update it with our updateData. Basically replacing it with a  new object
    Object.assign(course, updateData);

    await course.save();

    res.json({ message: "Course updated successfully", data: course });
  } catch (error) {
    res.status(500).json({ message: "Error updating course", error });
  }
};

export const deleteCourse = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { courseId } = req.params;
  const { userId } = getAuth(req);

  try {
    const course = await Course.get(courseId);

    if (!course) {
      res.status(404).json({ message: "Course not found" });
      return;
    }

    if (course.teacherId !== userId) {
      res.status(403).json({ message: "Not authorized to delete this course" });
      return;
    }

    await Course.delete(courseId);

    res.json({
      message: "Course deleted successfully",
      data: course,
    });
  } catch (error) {
    res.status(500).json({ message: "Error deleting course", error });
  }
};

export const getUploadVideoUrl = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { fileName, fileType } = req.body;

  if (!fileName || !fileType) {
    res.status(400).json({ message: "File name and type are required" });
    return;
  }

  try {
    const uniqueId = uuidv4();
    const s3Key = `videos/${uniqueId}/${fileName}`;

    const s3Params = {
      Bucket: process.env.S3_BUCKET_NAME || "",
      Key: s3Key,
      Expires: 60,
      ContentType: fileType,
    };

    // Get the signed url from s3 and cloudfront that allows us to upload. Anytime you're handling a large object, you need to use presigned url for uploading onto s3, because API Gateway has a limit of 10MB, and when we put videos that's going to exceed 10MB, so instead we need to do what's called a presigned url. Basically we're asking s3 to give us a URL from which we then send the video and upload. This typically happen on the frontend so it's not a backend thing, we're just telling s3 hey give us a URL on to the client/frontend, and there we use the URL to upload our video. From there we're able to construct our video URL using the uniqueId and fileName as long as we grab the cloudfront domain url.
    const uploadUrl = s3.getSignedUrl("putObject", s3Params);
    const videoUrl = `${process.env.CLOUDFRONT_DOMAIN}/videos/${uniqueId}/${fileName}`;

    res.json({
      message: "Upload URL generated successfully",
      data: { uploadUrl, videoUrl }, // We use the videoUrl to save in our database, so we know the link each chapter have for specific video. The uploadUrl is for uploading the actual video onto s3.
    });
  } catch (error) {
    res.status(500).json({ message: "Error generating upload URL", error });
  }
};
