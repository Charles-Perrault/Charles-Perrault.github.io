using System;
using System.Reflection;
using UnityEngine;

public static class TonyEagleFlipRegression
{
    public static void Validate(PlayerMove player)
    {
        BindingFlags flags = BindingFlags.Instance | BindingFlags.NonPublic;
        MethodInfo sample = typeof(PlayerMove).GetMethod("SpinChecker", flags);
        MethodInfo score = typeof(PlayerMove).GetMethod("CheckTricks", flags);
        FieldInfo previous = typeof(PlayerMove).GetField("previousTrickRotation", flags);
        Vector3 position = player.transform.position;
        Quaternion rotation = player.transform.rotation;
        Vector3 detectorPosition = player.trickSphere.position;
        Quaternion detectorRotation = player.trickSphere.rotation;
        bool enabled = player.enabled;
        GameObject blocker = null;
        try
        {
            player.enabled = false;
            player.transform.position = new Vector3(30, 50, -30);
            player.trickSphere.position = player.transform.position;
            blocker = GameObject.CreatePrimitive(PrimitiveType.Cube);
            blocker.transform.localScale = Vector3.one * 0.2f;
            blocker.transform.position = player.transform.position + Vector3.forward * 0.25f;
            Physics.SyncTransforms();
            RaycastHit oldHit;
            if (!Physics.Raycast(player.transform.position, Vector3.forward, out oldHit, (int)player.trickTriggerLayers) || oldHit.collider.gameObject != blocker)
                throw new Exception("Failed to reproduce park geometry blocking the old unfiltered trick ray");
            foreach (float tilt in new[] { 0f, 15f })
            foreach (int direction in new[] { -1, 1 })
            {
                Quaternion takeoff = Quaternion.Euler(tilt, tilt == 0 ? 0 : 50, 0);
                player.trickSphere.rotation = takeoff;
                player.transform.rotation = takeoff;
                previous.SetValue(player, takeoff);
                player.trickBlocks.Clear(); player.trickList.text = ""; player.score = 0; player.combo = 1;
                // 80-degree updates skip whole zones without the orientation sweep.
                foreach (float pitch in new[] { 0f, 80f, 160f, 240f, 320f, 360f })
                {
                    player.transform.rotation = takeoff * Quaternion.Euler(direction * pitch, 0, 0);
                    Physics.SyncTransforms(); sample.Invoke(player, null);
                }
                Debug.Log("TONY_EAGLE_FLIP_ZONES direction=" + direction + " tilt=" + tilt + " zones=" + String.Join(",", player.trickBlocks.ToArray()));
                score.Invoke(player, null);
                string name = direction < 0 ? "NECK SNAPPER" : "BALLS OF STEEL";
                if (!player.trickList.text.Contains(name) || player.score != 600 || player.combo != 2)
                    throw new Exception("Full flip not credited: " + name + " tilt=" + tilt + " text=" + player.trickList.text + " score=" + player.score);
                Debug.Log("TONY_EAGLE_FLIP_PASS " + name + " tilt=" + tilt + " score=" + player.score);
            }
            player.trickSphere.rotation = Quaternion.identity;
            player.transform.rotation = Quaternion.identity;
            previous.SetValue(player, Quaternion.identity);
            player.trickBlocks.Clear(); player.trickList.text = ""; player.score = 0; player.combo = 1;
            foreach (float pitch in new[] { 0f, 60f, 120f, 180f })
            {
                player.transform.rotation = Quaternion.Euler(pitch, 0, 0);
                Physics.SyncTransforms(); sample.Invoke(player, null);
            }
            score.Invoke(player, null);
            if (player.trickList.text.Contains("NECK SNAPPER") || player.trickList.text.Contains("BALLS OF STEEL"))
                throw new Exception("Half flip incorrectly counted as full flip");
            Debug.Log("TONY_EAGLE_FLIP_REGRESSION_PASSED obstruction, fast turns, both directions, tilted takeoff and partial-flip rejection");
        }
        finally
        {
            if (blocker != null) UnityEngine.Object.DestroyImmediate(blocker);
            player.transform.SetPositionAndRotation(position, rotation);
            player.trickSphere.SetPositionAndRotation(detectorPosition, detectorRotation);
            previous.SetValue(player, rotation);
            player.trickBlocks.Clear(); player.trickList.text = ""; player.score = 0; player.combo = 0;
            player.enabled = enabled;
        }
    }
}
