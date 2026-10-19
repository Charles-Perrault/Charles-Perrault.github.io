using System;
using System.Reflection;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;

[InitializeOnLoad]
public static class TonyEagleSingleTrickRegression
{
    private const string Key = "TonyEagle.SingleTrickRegression";
    static TonyEagleSingleTrickRegression() { EditorApplication.update += Tick; }
    public static void Validate() { Start(false); }
    public static void ValidateAndBuild() { Start(true); }
    private static void Start(bool build)
    {
        SessionState.SetBool(Key + "build", build);
        SessionState.SetInt(Key, 1);
        EditorSceneManager.OpenScene("Assets/Scene/Start.unity");
        EditorApplication.isPlaying = true;
    }
    private static void Require(bool value, string message)
    { if (!value) throw new Exception(message); }
    private static void Tick()
    {
        int stage = SessionState.GetInt(Key, 0);
        if (stage == 0) return;
        try
        {
            if (stage == 2 && !EditorApplication.isPlayingOrWillChangePlaymode)
            {
                SessionState.SetInt(Key, 0);
                Debug.Log("TONY_EAGLE_SINGLE_TRICK_PASSED first trick, combos, stale tricks, empty detection and real flip detection");
                if (SessionState.GetBool(Key + "build", false)) TonyEagleBuild.BuildWebGL();
                EditorApplication.Exit(0);
                return;
            }
            if (!EditorApplication.isPlaying || (stage != 1 && stage != 3)) return;
            if (stage == 1)
            {
                if (UnityEngine.Object.FindObjectOfType<ColorHolder>() == null) return;
                UnityEngine.SceneManagement.SceneManager.LoadScene("Map");
                SessionState.SetInt(Key, 3);
                return;
            }
            PlayerMove player = UnityEngine.Object.FindObjectOfType<PlayerMove>();
            if (player == null || player.trickList == null) return;
            player.enabled = false;
            MethodInfo score = typeof(PlayerMove).GetMethod("CheckTricks", BindingFlags.Instance | BindingFlags.NonPublic);
            string[] names = { "FRONTSIDE FLIPPER", "LEFTSIDE TORNADO", "NECK SNAPPER", "BALLS OF STEEL" };
            string[][] paths = {
                new[] { "Front", "FrontDownRight", "DownRight", "DownBackRight", "Back", "BackLeft", "FrontLeft" },
                new[] { "Front", "FrontDownLeft", "DownBottomLeft", "DownBackLeft", "Back", "FrontRight" },
                new[] { "Front", "TopFront", "Top", "TopBack", "Back", "DownBack", "Down", "FrontDown" },
                new[] { "Front", "FrontDown", "Down", "DownBack", "Back", "TopBack", "Top", "TopFront" }
            };
            int[] points = { 140, 140, 600, 600 };
            for (int i = 0; i < names.Length; i++)
            foreach (int combo in new[] { 0, 1, 3 })
            {
                player.trickBlocks.Clear(); player.trickBlocks.AddRange(paths[i]);
                player.trickList.text = ""; player.score = 0; player.combo = combo;
                score.Invoke(player, null);
                Require(player.trickList.text.Contains(names[i]), "Trick not detected: " + names[i]);
                Require(player.score == points[i] * Math.Max(1, combo), "Wrong score for " + names[i] + " combo=" + combo + " actual=" + player.score);
                Require(player.combo == combo + 1, "Combo changed incorrectly");
                Require(player.trickBlocks.Count == 0, "Trick detection was not reset");
                float total = player.score;
                player.trickBlocks.AddRange(paths[i]);
                score.Invoke(player, null);
                Require(player.score == total + points[i] / 2 * Math.Max(1, combo + 1), "Wrong stale score for " + names[i]);
                Require(player.combo == combo + 1, "Stale trick increased combo");
                Debug.Log("TONY_EAGLE_SINGLE_TRICK_PASS " + names[i] + " combo=" + combo + " first=" + total + " staleTotal=" + player.score);
            }
            player.trickBlocks.Clear(); player.trickList.text = ""; player.score = 0; player.combo = 0;
            score.Invoke(player, null);
            Require(player.score == 0 && player.combo == 0, "No trick awarded points");
            TonyEagleFlipRegression.Validate(player);
            SessionState.SetInt(Key, 2);
            EditorApplication.isPlaying = false;
        }
        catch (Exception error)
        {
            SessionState.SetInt(Key, 0);
            Debug.LogException(error);
            EditorApplication.Exit(1);
        }
    }
}
