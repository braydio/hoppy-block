import { updatePhysics } from './systems/physicsLoop'
import { updateAudio } from './systems/audioLoop'
import { updateCamera } from './systems/cameraLoop'
import { handleInputs } from './systems/inputLoop'
import { drawFrame } from './render/drawFrame'

export function gameLoop(runtime, deltaTime) {
  handleInputs(runtime)
  updateAudio(runtime, deltaTime)
  updatePhysics(runtime, deltaTime)
  updateCamera(runtime, deltaTime)
  drawFrame(runtime)
}
