//Configuration for Swagger to generate API documentation
import type { Application } from "express";
import swaggerUi from "swagger-ui-express";
import swaggerDoc from "../../swagger.json";

export default function swaggerSetup(app: Application): void {
    app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerDoc));
}
