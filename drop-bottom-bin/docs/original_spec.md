# Engineering Design Specifications: 1-Tonne Drop-Bottom Forklift Bin

## 1. Mechanism Analysis (Based on Video Reference)
The video demonstrates a **Drop-Bottom (or Bottom-Discharge) Bin**. 
*   **Lifting:** The forklift tines enter fork pockets welded to the *top* rim of the bin. This top-mount design allows the bottom to swing clear.
*   **Discharge:** The bottom of the bin consists of two hinged panels. These panels are held shut by a mechanical side latch. 
*   **Actuation:** A cable (attached to a lever on the latch mechanism) is routed to the forklift cabin. When the operator pulls the cable, it disengages the locking pin/catch. Gravity and the weight of the material force the bottom doors open, discharging the load.
*   **Reset/Locking:** To close the bin, the operator simply lowers the empty bin onto a flat surface (the ground). The ground pushes the doors upward into the closed position, and the spring-loaded side latch automatically snaps back into place, locking the bin for the next use.

## 2. Design Parameters (1 Tonne / 1000 kg Capacity)
To safely handle a 1-tonne dynamic load, the structure must be heavily reinforced to prevent bowing and latch failure.

*   **Target Safe Working Load (SWL):** 1000 kg (1 Tonne)
*   **Approximate Volume:** 1.0 Cubic Meter ($1 m^3$)
*   **Overall Dimensions:** 1200 mm (Length) x 1000 mm (Width) x 900 mm (Height)
*   **Empty Weight (Tare):** Approx. 180 - 220 kg

## 3. Bill of Materials (BOM) & Structural Sizing
*   **Main Body Panels (Sides, Front, Back):** 3mm Mild Steel Plate. *Crucial:* These must be corrugated (press-braked with ribs) as seen in the video, or externally braced with 50x50x5mm angle iron to prevent outward bowing under load.
*   **Drop Bottom Doors (x2):** 5mm or 6mm Mild Steel Plate. Heavily reinforced with 50x50x5mm Square Hollow Section (SHS) framework to prevent bending from point loads.
*   **Fork Pockets:** 150mm x 75mm x 5mm Rectangular Hollow Section (RHS). Length: 1200mm.
*   **Top Rim Reinforcement:** 50x50x5mm Angle Iron forming a continuous perimeter under the fork pockets.
*   **Hinges:** Heavy-duty barrel hinges with grease nipples. Minimum 20mm diameter solid steel hinge pins. Minimum 3 hinges per door.
*   **Latch Mechanism Components:**
    *   Locking Arms: 12mm thick profile-cut steel plate.
    *   Locking Pin/Catch: 25mm diameter solid high-tensile steel bar.
    *   Tension Spring: Heavy-duty coil spring to ensure the latch snaps back into the locked position.

## 4. Fabrication & Assembly Guide

### Step 1: Main Tub Assembly
1.  Cut and press-brake the 3mm sheet metal for the four sides to add structural ribs.
2.  Tack weld the sides together to form the rectangular box (1200x1000x900mm).
3.  Weld the 50x50mm angle iron perimeter around the top edge. 
4.  Fully seam weld the interior and exterior vertical joints.

### Step 2: Fork Pockets
1.  Cut the 150x75x5mm RHS to 1200mm lengths.
2.  Weld the fork pockets across the top of the bin (spanning the 1000mm width, overhanging slightly, or aligned with the edges depending on forklift spread). Ensure continuous, multi-pass welds here, as this bears the entire 1+ tonne load.

### Step 3: Bottom Doors & Hinges
1.  Fabricate the two bottom doors (1200mm x 500mm each) from 5mm plate, backed by SHS framing.
2.  Align the doors flush with the bottom of the tub.
3.  Weld the heavy-duty hinges to the lower edge of the tub and the doors. Ensure perfect alignment so the doors swing freely without binding.

### Step 4: The Latch Mechanism
1.  Mount the central pivot lever on one side of the tub.
2.  Attach linkage arms from the central lever to the locking catches on the bottom doors. 
3.  Install the tension spring so the default resting state of the lever holds the locking pin securely under the door lips.
4.  Attach an anchor loop to the top of the lever for the operator's pull-cable.

### Step 5: Finishing & Testing
1.  Grind all sharp edges.
2.  Apply industrial primer and a high-visibility powder coat or polyurethane topcoat (like the safety purple in the video).
3.  **Testing:** Do not immediately test with 1 tonne. Test empty first. Then test with 250kg, 500kg, and finally 1000kg (using sand or scrap). Check for any deformation in the bottom doors or bending in the latch pins.

## 5. Safety Considerations
*   **Secondary Safety Chain:** Always include a safety chain on the bin that wraps around the forklift mast to prevent the bin from sliding off the tines.
*   **Pinch Points:** The closing action of the bottom doors is a major crush hazard. Ensure warning decals are applied.